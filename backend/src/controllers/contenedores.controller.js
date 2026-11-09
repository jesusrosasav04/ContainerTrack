import * as service from '../services/contenedores.service.js';

// El controlador solo traduce HTTP <-> servicio. Los errores los atiende errorHandler.

export async function listar(req, res) {
  const { estado, naviera } = req.query;
  res.json(await service.listar({ estado, naviera }));
}

export async function obtener(req, res) {
  res.json(await service.obtener(req.params.numero));
}

export async function crear(req, res) {
  const contenedor = await service.crear(req.body ?? {});
  res.status(201).location(`/api/contenedores/${contenedor.numeroContenedor}`).json(contenedor);
}

export async function actualizar(req, res) {
  res.json(await service.actualizar(req.params.numero, req.body ?? {}));
}

export async function eliminar(req, res) {
  await service.eliminar(req.params.numero);
  res.status(204).end();
}

export async function historial(req, res) {
  res.json(await service.historial(req.params.numero));
}

export async function registrarMovimiento(req, res) {
  res.status(201).json(await service.registrarMovimiento(req.params.numero, req.body ?? {}));
}
