import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as ctrl from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Maximo 5 intentos fallidos por IP cada 15 minutos (los exitosos no cuentan)
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.' },
});

router.post('/login', limiteLogin, ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);
// Mismo limite: evita adivinar la contrasena actual desde una sesion robada
router.post('/cambiar-password', limiteLogin, requireAuth, ctrl.cambiarPassword);

export default router;
