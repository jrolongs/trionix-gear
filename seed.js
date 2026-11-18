import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./db.js";
import Equipo from "./models/Equipo.js";
import Usuario from "./models/Usuario.js";
import Prestamo from "./models/Prestamo.js";

async function seed() {
  await connectDB();

  await Promise.all([
    Prestamo.deleteMany({}),
    Equipo.deleteMany({}),
    Usuario.deleteMany({}),
  ]);

  // 8 equipos de varias categorías (4 quedarán prestados, 3 disponibles, 1 en mantenimiento)
  const equipos = await Equipo.create([
    {
      codigo: "EQ-0001",
      nombre: "MacBook Pro 14 M3",
      categoria: "portatil",
      estado: "disponible",
      ubicacion: "Almacen principal",
    },
    {
      codigo: "EQ-0002",
      nombre: "Dell Latitude 5540",
      categoria: "portatil",
      estado: "prestado",
      ubicacion: "Almacen principal",
    },
    {
      codigo: "EQ-0003",
      nombre: "Proyector Epson PowerLite X49",
      categoria: "proyector",
      estado: "prestado",
      ubicacion: "Sala Audiovisual",
    },
    {
      codigo: "EQ-0004",
      nombre: "Cámara Sony Alpha A6400",
      categoria: "camara",
      estado: "prestado",
      ubicacion: "Laboratorio Multimedia",
    },
    {
      codigo: "EQ-0005",
      nombre: "Kit Micrófonos Shure SM58",
      categoria: "audio",
      estado: "prestado",
      ubicacion: "Cabina de Sonido",
    },
    {
      codigo: "EQ-0006",
      nombre: "Switch Cisco Catalyst 2960",
      categoria: "redes",
      estado: "disponible",
      ubicacion: "Laboratorio de Redes",
    },
    {
      codigo: "EQ-0007",
      nombre: "Router MikroTik hAP ax3",
      categoria: "redes",
      estado: "disponible",
      ubicacion: "Laboratorio de Redes",
    },
    {
      codigo: "EQ-0008",
      nombre: "Proyector BenQ MH560",
      categoria: "proyector",
      estado: "mantenimiento",
      ubicacion: "Taller Técnico",
    },
  ]);

  // 5 usuarios de los tres tipos
  const usuarios = await Usuario.create([
    {
      nombre: "Jose David Rolong",
      documento: "1045789123",
      email: "jose.rolong@unisimon.edu.co",
      tipo: "estudiante",
      activo: true,
    },
    {
      nombre: "Laura Martínez Gómez",
      documento: "1002345678",
      email: "laura.martinez@unisimon.edu.co",
      tipo: "estudiante",
      activo: true,
    },
    {
      nombre: "Rafael Pérez Meriño",
      documento: "72345678",
      email: "rafael.perez@unisimon.edu.co",
      tipo: "docente",
      activo: true,
    },
    {
      nombre: "Carlos Mendoza Ruiz",
      documento: "87654321",
      email: "carlos.mendoza@trionix.edu.co",
      tipo: "administrativo",
      activo: true,
    },
    {
      nombre: "Sofía Herrera Díaz",
      documento: "1143567890",
      email: "sofia.herrera@unisimon.edu.co",
      tipo: "estudiante",
      activo: false,
    },
  ]);

  const ahora = new Date();
  const diasEnMs = 24 * 60 * 60 * 1000;

  // 6 préstamos: 2 devueltos, 3 activos vigentes y 1 activo vencido
  await Prestamo.create([
    // 1. Devuelto
    {
      equipoId: equipos[0]._id, // EQ-0001 (actualmente disponible)
      usuarioId: usuarios[0]._id, // Jose David (estudiante)
      fechaPrestamo: new Date(ahora.getTime() - 10 * diasEnMs),
      fechaLimite: new Date(ahora.getTime() - 5 * diasEnMs),
      fechaDevolucion: new Date(ahora.getTime() - 6 * diasEnMs),
      estado: "devuelto",
      observaciones: "Entregado en perfecto estado con cargador",
    },
    // 2. Devuelto
    {
      equipoId: equipos[5]._id, // EQ-0006 (actualmente disponible)
      usuarioId: usuarios[2]._id, // Rafael Pérez (docente)
      fechaPrestamo: new Date(ahora.getTime() - 8 * diasEnMs),
      fechaLimite: new Date(ahora.getTime() - 2 * diasEnMs),
      fechaDevolucion: new Date(ahora.getTime() - 3 * diasEnMs),
      estado: "devuelto",
      observaciones: "Práctica de laboratorio de redes",
    },
    // 3. Activo VENCIDO (fechaLimite en el pasado)
    {
      equipoId: equipos[1]._id, // EQ-0002 (estado: prestado)
      usuarioId: usuarios[0]._id, // Jose David (estudiante)
      fechaPrestamo: new Date(ahora.getTime() - 9 * diasEnMs),
      fechaLimite: new Date(ahora.getTime() - 2 * diasEnMs),
      fechaDevolucion: null,
      estado: "activo",
      observaciones: "Desarrollo proyecto web",
    },
    // 4. Activo vigente
    {
      equipoId: equipos[2]._id, // EQ-0003 (estado: prestado)
      usuarioId: usuarios[2]._id, // Rafael Pérez (docente)
      fechaPrestamo: new Date(ahora.getTime() - 1 * diasEnMs),
      fechaLimite: new Date(ahora.getTime() + 10 * diasEnMs),
      fechaDevolucion: null,
      estado: "activo",
      observaciones: "Clase magistral bloque B",
    },
    // 5. Activo vigente
    {
      equipoId: equipos[3]._id, // EQ-0004 (estado: prestado)
      usuarioId: usuarios[1]._id, // Laura Martínez (estudiante)
      fechaPrestamo: new Date(ahora.getTime() - 1 * diasEnMs),
      fechaLimite: new Date(ahora.getTime() + 4 * diasEnMs),
      fechaDevolucion: null,
      estado: "activo",
      observaciones: "Grabación evento facultad",
    },
    // 6. Activo vigente
    {
      equipoId: equipos[4]._id, // EQ-0005 (estado: prestado)
      usuarioId: usuarios[3]._id, // Carlos Mendoza (administrativo)
      fechaPrestamo: new Date(ahora.getTime() - 2 * diasEnMs),
      fechaLimite: new Date(ahora.getTime() + 3 * diasEnMs),
      fechaDevolucion: null,
      estado: "activo",
      observaciones: "Auditorio principal",
    },
  ]);

  console.log("Seed ejecutado correctamente: 8 equipos, 5 usuarios y 6 préstamos.");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Error ejecutando seed:", err);
  process.exit(1);
});
