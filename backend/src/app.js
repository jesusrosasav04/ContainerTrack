import express from 'express';
import cors from 'cors';
import { getPool } from './config/db.js';
import contenedoresRoutes from './routes/contenedores.routes.js';
import embarcacionesRoutes from './routes/embarcaciones.routes.js';
import puertosRoutes from './routes/puertos.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// Estado de la API y de la conexion a SQL Server
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    res.json({ status: 'ok', service: 'ContainerTrack API', database: 'conectada' });
  } catch (err) {
    res.status(503).json({ status: 'degradado', service: 'ContainerTrack API', database: 'sin conexion', detalle: err.message });
  }
});

app.use('/api/contenedores', contenedoresRoutes);
app.use('/api/embarcaciones', embarcacionesRoutes);
app.use('/api/puertos', puertosRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
