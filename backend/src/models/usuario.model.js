import { getPool, sql } from '../config/db.js';

const COLUMNAS = `Id AS id, Nombre AS nombre, Email AS email, Rol AS rol, Activo AS activo, FechaRegistro AS fechaRegistro`;

// Incluye el hash: solo para verificar la contrasena en el login
export async function findByEmailConHash(email) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('email', sql.NVarChar(150), email)
    .query(`SELECT ${COLUMNAS}, PasswordHash AS passwordHash FROM dbo.Usuarios WHERE Email = @email`);
  return recordset[0] ?? null;
}

export async function findById(id) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('id', sql.Int, id)
    .query(`SELECT ${COLUMNAS} FROM dbo.Usuarios WHERE Id = @id`);
  return recordset[0] ?? null;
}

export async function findAll() {
  const pool = await getPool();
  const { recordset } = await pool.request().query(`SELECT ${COLUMNAS} FROM dbo.Usuarios ORDER BY Nombre`);
  return recordset;
}

export async function create({ nombre, email, passwordHash, rol }) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('nombre', sql.NVarChar(100), nombre)
    .input('email', sql.NVarChar(150), email)
    .input('hash', sql.NVarChar(100), passwordHash)
    .input('rol', sql.VarChar(20), rol)
    .query(`INSERT INTO dbo.Usuarios (Nombre, Email, PasswordHash, Rol)
            OUTPUT INSERTED.Id VALUES (@nombre, @email, @hash, @rol)`);
  return recordset[0].Id;
}

export async function update(id, { rol, activo }) {
  const pool = await getPool();
  const req = pool.request().input('id', sql.Int, id);
  const sets = [];
  if (rol !== undefined) { req.input('rol', sql.VarChar(20), rol); sets.push('Rol = @rol'); }
  if (activo !== undefined) { req.input('activo', sql.Bit, activo); sets.push('Activo = @activo'); }
  if (!sets.length) return 0;
  await req.query(`UPDATE dbo.Usuarios SET ${sets.join(', ')} WHERE Id = @id`);
  return sets.length;
}
