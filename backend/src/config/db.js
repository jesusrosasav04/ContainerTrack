import sql from 'mssql';

const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  options: {
    encrypt: false,               // conexion local de desarrollo
    trustServerCertificate: true, // certificado autofirmado de SQL Server
  },
};

// Instancia con nombre (ej. SQLEXPRESS) usa el servicio SQL Browser; si no, puerto fijo.
if (process.env.DB_INSTANCE) {
  config.options.instanceName = process.env.DB_INSTANCE;
} else {
  config.port = Number(process.env.DB_PORT) || 1433;
}

let poolPromise = null;

// Un solo pool compartido por toda la API. Si falla, se reintenta en la siguiente peticion.
export function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

export async function closePool() {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.close();
    poolPromise = null;
  }
}

export { sql };
