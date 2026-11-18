import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./db.js";
import equiposRouter from "./routes/equipos.js";
import usuariosRouter from "./routes/usuarios.js";
import prestamosRouter from "./routes/prestamos.js";
import reportesRouter from "./routes/reportes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Healthcheck para Docker
app.get("/api/health", (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (isConnected) {
    return res.status(200).json({ status: "ok", db: "connected" });
  }
  return res.status(503).json({ status: "error", db: "disconnected" });
});

// Rutas de la API
app.use("/api/equipos", equiposRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/prestamos", prestamosRouter);
app.use("/api/reportes", reportesRouter);

// Manejo de rutas API no encontradas
app.use("/api", (req, res) => {
  res.status(404).json({ error: "Ruta de API no encontrada" });
});

// Middleware global de errores
app.use(errorHandler);

connectDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor Trionix Gear corriendo en http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error fatal conectando a MongoDB:", err);
    process.exit(1);
  });
