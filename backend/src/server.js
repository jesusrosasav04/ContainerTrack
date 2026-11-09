import 'dotenv/config';
import app from './app.js';
import { closePool } from './config/db.js';
import { comprobarConfiguracion } from './services/auth.service.js';
import { iniciarSimulador } from './services/simulador.service.js';

try {
  comprobarConfiguracion();
} catch (err) {
  console.error(`\n[config] ${err.message}\n`);
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
  iniciarSimulador();
});

// Cierre ordenado: libera las conexiones a SQL Server
async function shutdown() {
  server.close();
  await closePool().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
