# Trionix Gear — Sistema de Préstamo de Equipos

**Estudiante:** Jose David Rolong Sandoval  
**Asignatura:** Electiva Web Avanzada — Parcial Final (Tercer Corte)  
**Institución:** Universidad Simón Bolívar  

## Descripción del proyecto
Aplicación web full-stack para gestionar el inventario de equipos tecnológicos de Trionix Labs y el flujo de préstamos y devoluciones. Incluye API REST en Express con validación Joi, persistencia en MongoDB (Mongoose) con tres colecciones relacionadas (`equipos`, `usuarios`, `prestamos`), consultas de agregación (`$match`, `$group`, `$lookup`, `$sort`, `$limit`, `$facet`), reserva atómica contra condiciones de carrera (`findOneAndUpdate`), frontend estático con `fetch` sin recarga y despliegue orquestado con Docker Compose + Cloudflare Tunnel.

## Requisitos
- Docker Engine o Docker Desktop (con WSL2 en Windows) y Docker Compose v2.
- Conexión a internet para descargar imágenes base y negociar el túnel HTTPS.

## Instrucciones de despliegue
1. Clonar el repositorio y entrar al directorio:
```bash
git clone https://github.com/jrolongs/trionix-gear.git
cd trionix-gear
```
2. Crear `.env` a partir de `.env.example`:
```bash
cp .env.example .env
```
3. Construir y levantar los servicios en segundo plano:
```bash
docker compose up -d --build
```
4. Cargar los datos iniciales de prueba:
```bash
docker compose exec api node seed.js
```
5. Obtener la URL pública HTTPS del túnel:
```bash
docker compose logs tunnel | grep trycloudflare
```

## Variables de entorno
Definidas en `.env` (plantilla en `.env.example`, sin credenciales reales en el repositorio):
- `PORT`: Puerto interno en el que escucha el servidor Express (`3000`).
- `MONGODB_URI`: Cadena de conexión hacia MongoDB en la red interna de Docker (`mongodb://mongo:27017/trionixgear`).

## Diagrama de arquitectura y flujo de red
```text
Cliente Web (HTTPS) ---> Cloudflare Edge (*.trycloudflare.com)
                                | (Túnel saliente TLS, sin abrir puertos)
                                v
+-------------------------------------------------------------------+
| Red interna Docker Compose (trionix-net)                          |
|  [tunnel: cloudflared] ---> [api: Express :3000] ---> [mongo:7]   |
|                                                          |        |
|                                                  Volumen persistente
|                                                    (mongo-data)   |
+-------------------------------------------------------------------+
```

## Endpoints de la API
- `GET /api/health` (`200`, `503`): Estado del servicio y conexión a MongoDB.
- `GET /api/equipos` (`200`): Lista equipos (filtros `?categoria=`, `?estado=`).
- `GET /api/equipos/:id` (`200`, `400`, `404`): Consulta equipo por ObjectId.
- `GET /api/equipos/:id/prestamos` (`200`, `400`, `404`): Historial de préstamos del equipo.
- `POST /api/equipos` (`201`, `400`, `409`): Crea equipo validado con Joi.
- `PUT /api/equipos/:id` (`200`, `400`, `404`, `409`): Actualiza equipo o cambia estado (`disponible` / `mantenimiento`).
- `DELETE /api/equipos/:id` (`200`, `400`, `404`, `409`): Elimina equipo (bloqueado si está `prestado`).
- `GET /api/usuarios` (`200`): Lista usuarios (filtros `?tipo=`, `?activo=`).
- `GET /api/usuarios/:id` (`200`, `400`, `404`): Consulta usuario por ObjectId.
- `GET /api/usuarios/:id/prestamos` (`200`, `400`, `404`): Historial de préstamos del usuario.
- `POST /api/usuarios` (`201`, `400`, `409`): Crea usuario validado con Joi.
- `PUT /api/usuarios/:id` (`200`, `400`, `404`, `409`): Actualiza usuario.
- `DELETE /api/usuarios/:id` (`200`, `400`, `404`, `409`): Elimina usuario (bloqueado si tiene préstamos activos).
- `GET /api/prestamos` (`200`): Lista préstamos populados con campo calculado `vencido` (filtros `?estado=`, `?vencidos=true` y paginación `?page=&limit=`).
- `GET /api/prestamos/:id` (`200`, `400`, `404`): Consulta detalle de un préstamo.
- `POST /api/prestamos` (`201`, `400`, `404`, `409`): Registra préstamo con reglas R1-R4, reserva atómica R8 y compensación.
- `PATCH /api/prestamos/:id/devolver` (`200`, `400`, `404`, `409`): Registra devolución y libera equipo a `disponible` (R5).
- `GET /api/reportes/top-equipos` (`200`): Top equipos más prestados (`?limit=5`) vía `aggregate`.
- `GET /api/reportes/resumen` (`200`): Resumen general por estado, activos, vencidos y activos por tipo de usuario.

## Bonus implementados
- **Paginación e índice compuesto en `GET /api/prestamos`:** Soporta `?page=` y `?limit=` devolviendo `{ data, page, limit, total }`, respaldado por el índice compuesto `{ estado: 1, fechaPrestamo: -1 }` en el esquema `Prestamo`.
