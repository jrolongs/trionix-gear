import { Router } from "express";
import Joi from "joi";
import mongoose from "mongoose";
import Equipo from "../models/Equipo.js";
import Usuario from "../models/Usuario.js";
import Prestamo from "../models/Prestamo.js";
import {
  validateObjectId,
  validateBody,
  createHttpError,
} from "../middlewares/errorHandler.js";

const router = Router();

const objectIdValidator = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

const crearPrestamoSchema = Joi.object({
  equipoId: Joi.string().custom(objectIdValidator).required().messages({
    "any.invalid": "equipoId no es un ObjectId válido",
  }),
  usuarioId: Joi.string().custom(objectIdValidator).required().messages({
    "any.invalid": "usuarioId no es un ObjectId válido",
  }),
  fechaLimite: Joi.date().iso().required().messages({
    "date.base": "fechaLimite debe ser una fecha válida",
    "date.format": "fechaLimite debe tener formato de fecha válido (ISO)",
  }),
  observaciones: Joi.string().trim().max(300).allow("").default(""),
});

function formatearPrestamo(doc, ahora = new Date()) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.equipo = obj.equipoId;
  obj.usuario = obj.usuarioId;
  delete obj.equipoId;
  delete obj.usuarioId;
  obj.vencido = obj.estado === "activo" && new Date(obj.fechaLimite) < ahora;
  return obj;
}

const TOPES_POR_TIPO = {
  estudiante: 2,
  docente: 4,
  administrativo: 3,
};

// POST /api/prestamos
router.post("/", validateBody(crearPrestamoSchema), async (req, res, next) => {
  try {
    const { equipoId, usuarioId, fechaLimite, observaciones } = req.body;

    // 1. Verificar usuario (404 si no existe, 400 si está inactivo - R2)
    const usuario = await Usuario.findById(usuarioId);
    if (!usuario) {
      throw createHttpError(404, "Usuario no encontrado");
    }
    if (!usuario.activo) {
      throw createHttpError(
        400,
        "El usuario está inactivo y no puede recibir préstamos (R2)"
      );
    }

    // 2. Verificar que el equipo exista (404)
    const equipoExistente = await Equipo.findById(equipoId);
    if (!equipoExistente) {
      throw createHttpError(404, "Equipo no encontrado");
    }

    // 3. Validar fechaLimite (R4: futuro y máx 7 días, o 15 días para docentes)
    const ahora = new Date();
    const limite = new Date(fechaLimite);
    if (limite <= ahora) {
      throw createHttpError(
        400,
        "La fecha límite debe estar en el futuro (R4)"
      );
    }
    const maxDias = usuario.tipo === "docente" ? 15 : 7;
    const maxFecha = new Date(ahora.getTime() + maxDias * 24 * 60 * 60 * 1000);
    if (limite > maxFecha) {
      throw createHttpError(
        400,
        `Para el tipo '${usuario.tipo}', la fecha límite no puede superar los ${maxDias} días desde hoy (R4)`
      );
    }

    // 4. Validar tope de préstamos activos del usuario (R3)
    const tope = TOPES_POR_TIPO[usuario.tipo];
    const activosUsuario = await Prestamo.countDocuments({
      usuarioId,
      estado: "activo",
    });
    if (activosUsuario >= tope) {
      throw createHttpError(
        409,
        `El usuario de tipo '${usuario.tipo}' ya alcanzó su máximo de ${tope} préstamos activos (R3)`
      );
    }

    // 5. Actualización atómica condicional del equipo (R1 y R8)
    const equipoReservado = await Equipo.findOneAndUpdate(
      { _id: equipoId, estado: "disponible" },
      { estado: "prestado" },
      { new: true }
    );

    if (!equipoReservado) {
      const actual = await Equipo.findById(equipoId);
      const estadoActual = actual ? actual.estado : "no disponible";
      throw createHttpError(
        409,
        `El equipo no está disponible para préstamo; su estado actual es '${estadoActual}' (R1/R8)`
      );
    }

    // 6. Crear préstamo con compensación si falla la escritura
    let nuevoPrestamo;
    try {
      nuevoPrestamo = await Prestamo.create({
        equipoId,
        usuarioId,
        fechaLimite: limite,
        observaciones,
      });
    } catch (errCrear) {
      await Equipo.findByIdAndUpdate(equipoId, { estado: "disponible" });
      throw errCrear;
    }

    const prestamoPopulado = await Prestamo.findById(nuevoPrestamo._id)
      .populate("equipoId", "codigo nombre categoria")
      .populate("usuarioId", "nombre tipo");

    res.status(201).json(formatearPrestamo(prestamoPopulado, ahora));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/prestamos/:id/devolver
router.patch("/:id/devolver", validateObjectId("id"), async (req, res, next) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id);
    if (!prestamo) {
      throw createHttpError(404, "Préstamo no encontrado");
    }
    if (prestamo.estado === "devuelto") {
      throw createHttpError(409, "Este préstamo ya fue devuelto anteriormente");
    }

    // R5: actualizar préstamo y devolver equipo a disponible
    prestamo.estado = "devuelto";
    prestamo.fechaDevolucion = new Date();
    await prestamo.save();

    await Equipo.findByIdAndUpdate(prestamo.equipoId, {
      estado: "disponible",
    });

    const prestamoPopulado = await Prestamo.findById(prestamo._id)
      .populate("equipoId", "codigo nombre categoria")
      .populate("usuarioId", "nombre tipo");

    res.json(formatearPrestamo(prestamoPopulado));
  } catch (err) {
    next(err);
  }
});

// GET /api/prestamos (?estado=activo|devuelto & ?vencidos=true & opcional ?page=&limit=)
router.get("/", async (req, res, next) => {
  try {
    const ahora = new Date();
    const filtro = {};

    if (req.query.estado) {
      filtro.estado = req.query.estado;
    }

    if (req.query.vencidos === "true") {
      filtro.estado = "activo";
      filtro.fechaLimite = { $lt: ahora };
    }

    const usaPaginacion =
      req.query.page !== undefined || req.query.limit !== undefined;

    if (usaPaginacion) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const skip = (page - 1) * limit;

      const [total, prestamos] = await Promise.all([
        Prestamo.countDocuments(filtro),
        Prestamo.find(filtro)
          .sort({ fechaPrestamo: -1 })
          .skip(skip)
          .limit(limit)
          .populate("equipoId", "codigo nombre categoria")
          .populate("usuarioId", "nombre tipo"),
      ]);

      return res.json({
        data: prestamos.map((p) => formatearPrestamo(p, ahora)),
        page,
        limit,
        total,
      });
    }

    const prestamos = await Prestamo.find(filtro)
      .sort({ fechaPrestamo: -1 })
      .populate("equipoId", "codigo nombre categoria")
      .populate("usuarioId", "nombre tipo");

    res.json(prestamos.map((p) => formatearPrestamo(p, ahora)));
  } catch (err) {
    next(err);
  }
});

// GET /api/prestamos/:id
router.get("/:id", validateObjectId("id"), async (req, res, next) => {
  try {
    const prestamo = await Prestamo.findById(req.params.id)
      .populate("equipoId", "codigo nombre categoria")
      .populate("usuarioId", "nombre tipo");

    if (!prestamo) {
      throw createHttpError(404, "Préstamo no encontrado");
    }

    res.json(formatearPrestamo(prestamo));
  } catch (err) {
    next(err);
  }
});

export default router;
