import mongoose from "mongoose";

const equipoSchema = new mongoose.Schema(
  {
    codigo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      match: /^EQ-\d{4}$/,
    },
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    categoria: {
      type: String,
      required: true,
      enum: ["portatil", "proyector", "camara", "audio", "redes"],
    },
    estado: {
      type: String,
      default: "disponible",
      enum: ["disponible", "prestado", "mantenimiento"],
    },
    ubicacion: {
      type: String,
      trim: true,
      default: "Almacen principal",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Equipo", equipoSchema);
