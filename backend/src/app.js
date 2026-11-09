import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { getPool } from './config/db.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import authRoutes from './routes/auth.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import contenedoresRoutes from './routes/contenedores.routes.js';
import embarcacionesRoutes from './routes/embarcaciones.routes.js';
import puertosRoutes from './routes/puertos.routes.js';
import estadisticasRoutes from './routes/estadisticas.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

/* ---------- Seguridad general ---------- */
app.use(helmet());                                   // cabeceras: nosniff, frameguard, HSTS, etc.
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,                                 // permite enviar la cookie de sesion
}));
app.use(express.json({ limit: '100kb' }));           // evita cuerpos gigantes
app.use(cookieParser());
app.use('/api', rateLimit({                          // limite global contra abuso
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
}));

/* ---------- Rutas publicas ---------- */
app.get('/api/health', async (req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS ok');
    res.json({ status: 'ok', service: 'ContainerTrack API', database: 'conectada' });
  } catch (err) {
    console.error('[health]', err.message);           // el detalle se queda en el servidor
    res.status(503).json({ status: 'degradado', service: 'ContainerTrack API', database: 'sin conexion' });
  }
});
app.use('/api/auth', authRoutes);

/* ---------- Rutas protegidas (requieren sesion) ---------- */
app.use('/api/contenedores', requireAuth, contenedoresRoutes);
app.use('/api/embarcaciones', requireAuth, embarcacionesRoutes);
app.use('/api/puertos', requireAuth, puertosRoutes);
app.use('/api/usuarios', requireAuth, requireRole('ADMIN'), usuariosRoutes);
app.use('/api/estadisticas', requireAuth, requireRole('ADMIN'), estadisticasRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
