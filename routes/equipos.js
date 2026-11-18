import { Router } from "express";
import Joi from "joi";
import Equipo from "../models/Equipo.js";
import Prestamo from "../models/Prestamo.js";
import {
  validateObjectId,
  validateBody,
  createHttpError,
} from "../middlewares/errorHandler.js";

const router = Router();

const crearEquipoSchema = Joi.object({
  codigo: Joi.string()
    .uppercase()
    .trim()
    .pattern(/^EQ-\d{4}$/)
    .required()
    .messages({
      "string.pattern.base": "El código debe tener el formato EQ-0000",
    }),
  nombre: Joi.string().trim().min(3).max(100).required(),
  categoria: Joi.string()
    .valid("portatil", "proyector", "camara", "audio", "redes")
    .required(),
  estado: Joi.string().valid("disponible", "mantenimiento").default("disponible"),
  ubicacion: Joi.string().trim().default("Almacen principal"),
});

const actualizarEquipoSchema = Joi.object({
  codigo: Joi.string()
    .uppercase()
    .trim()
    .pattern(/^EQ-\d{4}$/)
    .messages({
      "string.pattern.base": "El código debe tener el formato EQ-0000",
    }),
  nombre: Joi.string().trim().min(3).max(100),
  categoria: Joi.string().valid(
    "portatil",
    "proyector",
    "camara",
    "audio",
    "redes"
  ),
  estado: Joi.string().valid("disponible", "mantenimiento").messages({
    "any.only":
      "Con PUT el estado solo puede ser 'disponible' o 'mantenimiento'",
  }),
  ubicacion: Joi.string().trim(),
}).min(1);

// GET /api/equipos (?categoria=&estado=)
router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.categoria) filtro.categoria = req.query.categoria;
    if (req.query.estado) filtro.estado = req.query.estado;

    const equipos = await Equipo.find(filtro).sort({ codigo: 1 });
    res.json(equipos);
  } catch (err) {
    next(err);
  }
});

// GET /api/equipos/:id/prestamos
router.get("/:id/prestamos", validateObjectId("id"), async (req, res, next) => {
  try {
    const equipo = await Equipo.findById(req.params.id);
    if (!equipo) throw createHttpError(404, "Equipo no encontrado");

    const prestamos = await Prestamo.find({ equipoId: req.params.id })
      .populate("equipoId", "codigo nombre categoria")
      .populate("usuarioId", "nombre tipo")
      .sort({ fechaPrestamo: -1 });

    const ahora = new Date();
    const resultado = prestamos.map((p) => {
      const obj = p.toObject();
      obj.equipo = obj.equipoId;
      obj.usuario = obj.usuarioId;
      delete obj.equipoId;
      delete obj.usuarioId;
      obj.vencido = obj.estado === "activo" && new Date(obj.fechaLimite) < ahora;
      return obj;
    });

    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// GET /api/equipos/:id
router.get("/:id", validateObjectId("id"), async (req, res, next) => {
  try {
    const equipo = await Equipo.findById(req.params.id);
    if (!equipo) throw createHttpError(404, "Equipo no encontrado");
    res.json(equipo);
  } catch (err) {
    next(err);
  }
});

// POST /api/equipos
router.post("/", validateBody(crearEquipoSchema), async (req, res, next) => {
  try {
    const nuevoEquipo = await Equipo.create(req.body);
    res.status(201).json(nuevoEquipo);
  } catch (err) {
    next(err);
  }
});

// PUT /api/equipos/:id
router.put(
  "/:id",
  validateObjectId("id"),
  validateBody(actualizarEquipoSchema),
  async (req, res, next) => {
    try {
      const equipoActual = await Equipo.findById(req.params.id);
      if (!equipoActual) throw createHttpError(404, "Equipo no encontrado");

      if (
        equipoActual.estado === "prestado" &&
        req.body.estado &&
        req.body.estado !== "prestado"
      ) {
        throw createHttpError(
          409,
          "No se puede cambiar el estado de un equipo prestado mediante PUT; debe registrarse su devolución"
        );
      }

      const actualizado = await Equipo.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      res.json(actualizado);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/equipos/:id
router.delete("/:id", validateObjectId("id"), async (req, res, next) => {
  try {
    const equipo = await Equipo.findById(req.params.id);
    if (!equipo) throw createHttpError(404, "Equipo no encontrado");

    if (equipo.estado === "prestado") {
      throw createHttpError(
        409,
        "No se puede eliminar un equipo que se encuentra prestado (R7)"
      );
    }

    await Equipo.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Equipo eliminado correctamente", equipo });
  } catch (err) {
    next(err);
  }
});

export default router;
