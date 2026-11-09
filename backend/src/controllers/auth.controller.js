import * as auth from '../services/auth.service.js';

// El token va en una cookie httpOnly: JavaScript del navegador no puede leerla,
// asi un ataque XSS no puede robar la sesion. SameSite=Strict bloquea el envio
// de la cookie desde otros sitios (proteccion CSRF).
const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',   // solo HTTPS en produccion
  path: '/api',
  maxAge: auth.horasSesion() * 60 * 60 * 1000,
});

export async function login(req, res) {
  const { email, password } = req.body ?? {};
  const { token, usuario } = await auth.login(email, password);
  res.cookie(auth.COOKIE, token, opcionesCookie());
  res.json({ usuario });
}

export function logout(req, res) {
  const { maxAge, ...opciones } = opcionesCookie();
  res.clearCookie(auth.COOKIE, opciones);
  res.status(204).end();
}

export function me(req, res) {
  res.json({ usuario: req.usuario });
}
