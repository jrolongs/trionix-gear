import { Router } from "express";
import Equipo from "../models/Equipo.js";
import Prestamo from "../models/Prestamo.js";

const router = Router();

// GET /api/reportes/top-equipos?limit=5
router.get("/top-equipos", async (req, res, next) => {
  try {
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 5);

    const topEquipos = await Prestamo.aggregate([
      {
        $group: {
          _id: "$equipoId",
          totalPrestamos: { $sum: 1 },
        },
      },
      { $sort: { totalPrestamos: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "equipos",
          localField: "_id",
          foreignField: "_id",
          as: "equipo",
        },
      },
      { $unwind: "$equipo" },
      {
        $project: {
          _id: 0,
          equipoId: "$_id",
          codigo: "$equipo.codigo",
          nombre: "$equipo.nombre",
          totalPrestamos: 1,
        },
      },
    ]);

    res.json(topEquipos);
  } catch (err) {
    next(err);
  }
});

// GET /api/reportes/resumen
router.get("/resumen", async (req, res, next) => {
  try {
    const ahora = new Date();

    const [equiposPorEstadoRaw, prestamosStats] = await Promise.all([
      Equipo.aggregate([
        {
          $group: {
            _id: "$estado",
            cantidad: { $sum: 1 },
          },
        },
      ]),
      Prestamo.aggregate([
        {
          $facet: {
            activos: [
              { $match: { estado: "activo" } },
              { $count: "total" },
            ],
            vencidos: [
              { $match: { estado: "activo", fechaLimite: { $lt: ahora } } },
              { $count: "total" },
            ],
            activosPorTipoUsuario: [
              { $match: { estado: "activo" } },
              {
                $lookup: {
                  from: "usuarios",
                  localField: "usuarioId",
                  foreignField: "_id",
                  as: "usuario",
                },
              },
              { $unwind: "$usuario" },
              {
                $group: {
                  _id: "$usuario.tipo",
                  cantidad: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]),
    ]);

    const equiposPorEstado = {
      disponible: 0,
      prestado: 0,
      mantenimiento: 0,
    };
    for (const item of equiposPorEstadoRaw) {
      equiposPorEstado[item._id] = item.cantidad;
    }

    const facetData = prestamosStats[0] || {};
    const prestamosActivos = facetData.activos?.[0]?.total || 0;
    const prestamosVencidos = facetData.vencidos?.[0]?.total || 0;

    const prestamosActivosPorTipoUsuario = {
      estudiante: 0,
      docente: 0,
      administrativo: 0,
    };
    for (const item of facetData.activosPorTipoUsuario || []) {
      prestamosActivosPorTipoUsuario[item._id] = item.cantidad;
    }

    res.json({
      equiposPorEstado,
      prestamosActivos,
      prestamosVencidos,
      prestamosActivosPorTipoUsuario,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
