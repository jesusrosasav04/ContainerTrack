// Error con codigo HTTP, lanzado desde servicios y controladores
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

// Express 5 envia aqui los errores de funciones async automaticamente
export function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalido en el cuerpo de la peticion' });
  }

  // Violaciones de UNIQUE / FOREIGN KEY / CHECK de SQL Server
  if (err.number === 2627 || err.number === 2601) {
    return res.status(409).json({ error: 'El registro ya existe' });
  }
  if (err.number === 547) {
    return res.status(409).json({ error: 'Referencia invalida o el registro esta en uso' });
  }

  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor' : err.message,
    ...(err.details && { detalles: err.details }),
  });
}
