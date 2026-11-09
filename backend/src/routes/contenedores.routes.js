import { Router } from 'express';
import * as ctrl from '../controllers/contenedores.controller.js';

const router = Router();

router.get('/', ctrl.listar);                                   // ?estado=EN_TRANSITO&naviera=MSC
router.post('/', ctrl.crear);
router.get('/:numero', ctrl.obtener);
router.patch('/:numero', ctrl.actualizar);
router.delete('/:numero', ctrl.eliminar);
router.get('/:numero/historial', ctrl.historial);
router.post('/:numero/movimientos', ctrl.registrarMovimiento);

export default router;
