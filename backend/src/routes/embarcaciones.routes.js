import { Router } from 'express';
import * as ctrl from '../controllers/embarcaciones.controller.js';
import { requireRole } from '../middleware/auth.js';

// Todas requieren sesion (ver app.js). Alta y edicion: OPERADOR o ADMIN.
const router = Router();
const editores = requireRole('ADMIN', 'OPERADOR');

router.get('/', ctrl.listar);
router.post('/', editores, ctrl.crear);
router.get('/:imo', ctrl.obtener);
router.patch('/:imo', editores, ctrl.actualizar);
router.get('/:imo/ubicaciones', ctrl.ubicaciones);   // ?limite=50

export default router;
