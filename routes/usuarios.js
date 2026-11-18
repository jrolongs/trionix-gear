import { Router } from "express";
import Joi from "joi";
import Usuario from "../models/Usuario.js";
import Prestamo from "../models/Prestamo.js";
import {
  validateObjectId,
  validateBody,
  createHttpError,
} from "../middlewares/errorHandler.js";

const router = Router();

const crearUsuarioSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(100).required(),
  documento: Joi.string()
    .trim()
    .pattern(/^\d{6,12}$/)
    .required()
    .messages({
      "string.pattern.base": "El documento debe tener entre 6 y 12 dígitos",
    }),
  email: Joi.string().trim().lowercase().email().required(),
  tipo: Joi.string()
    .valid("estudiante", "docente", "administrativo")
    .required(),
  activo: Joi.boolean().default(true),
});

const actualizarUsuarioSchema = Joi.object({
  nombre: Joi.string().trim().min(3).max(100),
  documento: Joi.string()
    .trim()
    .pattern(/^\d{6,12}$/)
    .messages({
      "string.pattern.base": "El documento debe tener entre 6 y 12 dígitos",
    }),
  email: Joi.string().trim().lowercase().email(),
  tipo: Joi.string().valid("estudiante", "docente", "administrativo"),
  activo: Joi.boolean(),
}).min(1);

// GET /api/usuarios (?tipo=&activo=)
router.get("/", async (req, res, next) => {
  try {
    const filtro = {};
    if (req.query.tipo) filtro.tipo = req.query.tipo;
    if (req.query.activo !== undefined && req.query.activo !== "") {
      filtro.activo = req.query.activo === "true";
    }

    const usuarios = await Usuario.find(filtro).sort({ nombre: 1 });
    res.json(usuarios);
  } catch (err) {
    next(err);
  }
});

// GET /api/usuarios/:id/prestamos
router.get("/:id/prestamos", validateObjectId("id"), async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) throw createHttpError(404, "Usuario no encontrado");

    const prestamos = await Prestamo.find({ usuarioId: req.params.id })
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

// GET /api/usuarios/:id
router.get("/:id", validateObjectId("id"), async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) throw createHttpError(404, "Usuario no encontrado");
    res.json(usuario);
  } catch (err) {
    next(err);
  }
});

// POST /api/usuarios
router.post("/", validateBody(crearUsuarioSchema), async (req, res, next) => {
  try {
    const nuevoUsuario = await Usuario.create(req.body);
    res.status(201).json(nuevoUsuario);
  } catch (err) {
    next(err);
  }
});

// PUT /api/usuarios/:id
router.put(
  "/:id",
  validateObjectId("id"),
  validateBody(actualizarUsuarioSchema),
  async (req, res, next) => {
    try {
      const actualizado = await Usuario.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!actualizado) throw createHttpError(404, "Usuario no encontrado");
      res.json(actualizado);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/usuarios/:id
router.delete("/:id", validateObjectId("id"), async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) throw createHttpError(404, "Usuario no encontrado");

    const prestamosActivos = await Prestamo.countDocuments({
      usuarioId: req.params.id,
      estado: "activo",
    });

    if (prestamosActivos > 0) {
      throw createHttpError(
        409,
        "No se puede eliminar un usuario que tiene préstamos activos (R7)"
      );
    }

    await Usuario.findByIdAndDelete(req.params.id);
    res.json({ mensaje: "Usuario eliminado correctamente", usuario });
  } catch (err) {
    next(err);
  }
});

export default router;
