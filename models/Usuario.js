import mongoose from "mongoose";

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    documento: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^\d{6,12}$/,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    tipo: {
      type: String,
      required: true,
      enum: ["estudiante", "docente", "administrativo"],
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Usuario", usuarioSchema);
