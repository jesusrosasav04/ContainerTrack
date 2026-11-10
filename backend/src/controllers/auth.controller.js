import * as auth from '../services/auth.service.js';

// El token va en una cookie httpOnly: JavaScript del navegador no puede leerla,
// asi un ataque XSS no puede robar la sesion. SameSite=Strict bloquea el envio
// de la cookie desde otros sitios (proteccion CSRF).
// Secure (solo HTTPS): activo en produccion salvo COOKIE_SECURE=false (p. ej. Docker local sin HTTPS).
const cookieSegura = () =>
  process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : process.env.NODE_ENV === 'production';

const opcionesCookie = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: cookieSegura(),
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

export async function cambiarPassword(req, res) {
  const { actual, nueva } = req.body ?? {};
  const token = await auth.cambiarPassword(req.usuario, actual, nueva);
  res.cookie(auth.COOKIE, token, opcionesCookie());   // esta sesion sigue; las demas se cierran
  res.json({ ok: true });
}
