// Agrega a backend/.env un JWT_SECRET aleatorio (si no existe) y la duracion de la sesion.
// Uso: npm run secreto
import fs from 'node:fs';
import crypto from 'node:crypto';

const ruta = new URL('../.env', import.meta.url);
let contenido = fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : '';

if (/^JWT_SECRET=.{32,}$/m.test(contenido)) {
  console.log('JWT_SECRET ya esta configurado. No se cambio nada.');
  process.exit(0);
}

contenido = contenido.replace(/^JWT_SECRET=.*\r?\n?/m, '').replace(/\s*$/, '\n');
contenido += `\n# Firma de los tokens de sesion. Si lo cambias, todas las sesiones se cierran.\n`;
contenido += `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}\n`;
if (!/^SESSION_HOURS=/m.test(contenido)) contenido += 'SESSION_HOURS=8\n';

fs.writeFileSync(ruta, contenido);
console.log('JWT_SECRET generado en backend/.env');
