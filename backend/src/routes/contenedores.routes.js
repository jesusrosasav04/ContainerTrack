import { Router } from 'express';
import * as ctrl from '../controllers/contenedores.controller.js';
import { requireRole } from '../middleware/auth.js';

// Todas las rutas requieren sesion (ver app.js). Escribir requiere OPERADOR o ADMIN;
// eliminar, solo ADMIN. El rol CONSULTA solo puede leer.
const router = Router();
const editores = requireRole('ADMIN', 'OPERADOR');

router.get('/', ctrl.listar);                                   // ?estado=EN_TRANSITO&naviera=MSC
router.post('/', editores, ctrl.crear);
router.get('/:numero', ctrl.obtener);
router.patch('/:numero', editores, ctrl.actualizar);
router.delete('/:numero', requireRole('ADMIN'), ctrl.eliminar);
router.get('/:numero/historial', ctrl.historial);
router.post('/:numero/movimientos', editores, ctrl.registrarMovimiento);

export default router;
