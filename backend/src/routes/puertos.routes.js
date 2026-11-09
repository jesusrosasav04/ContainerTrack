import { Router } from 'express';
import { getPool } from '../config/db.js';

const router = Router();

// Catalogo de puertos (para formularios y el mapa)
router.get('/', async (req, res) => {
  const pool = await getPool();
  const { recordset } = await pool.request().query(
    `SELECT Id AS id, Codigo AS codigo, Nombre AS nombre, Pais AS pais,
            Latitud AS latitud, Longitud AS longitud
     FROM dbo.Puertos ORDER BY Nombre`
  );
  res.json(recordset);
});

export default router;
