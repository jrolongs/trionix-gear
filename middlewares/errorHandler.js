import mongoose from "mongoose";

export function validateObjectId(paramName = "id") {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return res.status(400).json({
        error: `El parámetro '${paramName}' no es un ObjectId válido`,
      });
    }
    next();
  };
}

export function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      const detalles = error.details.map((d) => d.message).join("; ");
      return res.status(400).json({ error: detalles });
    }
    req.body = value;
    next();
  };
}

export function createHttpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export function errorHandler(err, req, res, next) {
  // Error 11000: Índice único duplicado en MongoDB -> 409 Conflict
  if (err.code === 11000) {
    const campo = err.keyValue ? Object.keys(err.keyValue)[0] : "campo";
    return res.status(409).json({
      error: `Ya existe un registro con ese ${campo}`,
    });
  }

  // Errores de validación o casteo de Mongoose -> 400 Bad Request
  if (err.name === "ValidationError") {
    const mensajes = Object.values(err.errors)
      .map((e) => e.message)
      .join("; ");
    return res.status(400).json({ error: mensajes });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      error: `Valor inválido para el campo '${err.path}'`,
    });
  }

  // Errores HTTP controlados (400, 404, 409, etc.)
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  console.error("Error inesperado:", err);
  return res.status(500).json({ error: "Error interno del servidor" });
}
