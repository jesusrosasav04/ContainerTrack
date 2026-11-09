import { Router } from 'express';
import * as ctrl from '../controllers/embarcaciones.controller.js';

const router = Router();

router.get('/', ctrl.listar);
router.get('/:imo', ctrl.obtener);
router.get('/:imo/ubicaciones', ctrl.ubicaciones);   // ?limite=50

export default router;
