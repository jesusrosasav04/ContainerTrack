// Crea un usuario ADMIN de forma interactiva. La contrasena no se muestra al escribirla.
// Uso: npm run crear-admin
import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { crearUsuario, validarPassword } from '../src/services/auth.service.js';
import { closePool } from '../src/config/db.js';

const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });

// Pregunta sin mostrar lo que se escribe
let silencio = false;
rl._writeToOutput = (texto) => { if (!silencio) stdout.write(texto); };
async function preguntarOculto(pregunta) {
  const respuesta = rl.question(pregunta);
  silencio = true;
  const valor = await respuesta;
  silencio = false;
  stdout.write('\n');
  return valor;
}

try {
  console.log('\nCrear usuario administrador de ContainerTrack\n');
  const nombre = await rl.question('Nombre completo: ');
  const email = await rl.question('Correo: ');

  let password;
  for (;;) {
    password = await preguntarOculto('Contrasena (min. 10, letras y numeros): ');
    const error = validarPassword(password);
    if (error) { console.log(`  ${error}`); continue; }
    if (password !== await preguntarOculto('Repite la contrasena: ')) { console.log('  No coinciden.'); continue; }
    break;
  }

  const usuario = await crearUsuario({ nombre, email, password, rol: 'ADMIN' });
  console.log(`\nAdministrador creado: ${usuario.nombre} <${usuario.email}>`);
} catch (err) {
  const detalle = err.details ? `: ${err.details.join('; ')}` : '';
  const yaExiste = err.number === 2627 || err.number === 2601;
  console.error(`\nNo se pudo crear el usuario: ${yaExiste ? 'ese correo ya esta registrado' : err.message + detalle}`);
  process.exitCode = 1;
} finally {
  rl.close();
  await closePool();
}
