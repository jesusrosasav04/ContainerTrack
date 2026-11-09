import * as Contenedor from '../models/contenedor.model.js';
import { HttpError } from '../middleware/errorHandler.js';

export const TIPOS = ['20GP', '40GP', '40HC', '20RF', '40RF'];
export const ESTADOS = ['REGISTRADO', 'EN_PUERTO', 'EN_TRANSITO', 'EN_ADUANA', 'ENTREGADO'];

// Cada evento del historial deja al contenedor en un estado
export const ESTADO_POR_EVENTO = {
  REGISTRO: 'REGISTRADO',
  CARGA: 'EN_PUERTO',
  SALIDA: 'EN_TRANSITO',
  ARRIBO: 'EN_PUERTO',
  DESCARGA: 'EN_PUERTO',
  ADUANA: 'EN_ADUANA',
  ENTREGA: 'ENTREGADO',
};

/* ---------- ISO 6346 ----------
   4 letras (dueno + categoria U/J/Z) + 6 digitos de serie + 1 digito de control.
   Cada letra vale 10..38 saltando multiplos de 11; cada posicion se multiplica por 2^i;
   el digito de control es (suma mod 11) mod 10. */
const VALOR_LETRA = {};
for (let i = 0, v = 10; i < 26; i++, v++) {
  if (v % 11 === 0) v++;
  VALOR_LETRA[String.fromCharCode(65 + i)] = v;
}

export function digitoControl(diezPrimeros) {
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    const c = diezPrimeros[i];
    const valor = /[A-Z]/.test(c) ? VALOR_LETRA[c] : Number(c);
    suma += valor * 2 ** i;
  }
  return (suma % 11) % 10;
}

export function validarNumero(numero) {
  if (typeof numero !== 'string') return 'El numero de contenedor es obligatorio';
  const n = numero.trim().toUpperCase();
  if (!/^[A-Z]{3}[UJZ]\d{7}$/.test(n)) {
    return 'Formato invalido: 3 letras, U/J/Z y 7 digitos (ej. MSCU1234566)';
  }
  if (digitoControl(n) !== Number(n[10])) {
    return `Digito de control incorrecto: deberia ser ${digitoControl(n)}`;
  }
  return null;
}

const normalizar = (numero) => String(numero).trim().toUpperCase();

function validarDatos(d, parcial = false) {
  const errores = [];
  const requerido = (campo) => !parcial || d[campo] !== undefined;

  if (requerido('tipoContenedor') && !TIPOS.includes(d.tipoContenedor)) {
    errores.push(`tipoContenedor debe ser uno de: ${TIPOS.join(', ')}`);
  }
  if (requerido('naviera') && (typeof d.naviera !== 'string' || !d.naviera.trim() || d.naviera.length > 100)) {
    errores.push('naviera es obligatoria (maximo 100 caracteres)');
  }
  for (const campo of ['puertoOrigen', 'puertoDestino']) {
    if (requerido(campo) && !/^[A-Z]{5}$/.test(d[campo] ?? '')) {
      errores.push(`${campo} debe ser un codigo UN/LOCODE de 5 letras (ej. MXZLO)`);
    }
  }
  if (d.puertoOrigen && d.puertoOrigen === d.puertoDestino) {
    errores.push('El puerto de origen y destino deben ser distintos');
  }
  if (d.embarcacionImo != null && !/^\d{7}$/.test(d.embarcacionImo)) {
    errores.push('embarcacionImo debe tener 7 digitos');
  }
  if (d.estado !== undefined && !ESTADOS.includes(d.estado)) {
    errores.push(`estado debe ser uno de: ${ESTADOS.join(', ')}`);
  }
  if (errores.length) throw new HttpError(400, 'Datos invalidos', errores);
}

export async function listar(filtros) {
  if (filtros.estado && !ESTADOS.includes(filtros.estado)) {
    throw new HttpError(400, `estado debe ser uno de: ${ESTADOS.join(', ')}`);
  }
  return Contenedor.findAll(filtros);
}

export async function obtener(numero) {
  const error = validarNumero(numero);
  if (error) throw new HttpError(400, error);
  const contenedor = await Contenedor.findByNumero(normalizar(numero));
  if (!contenedor) throw new HttpError(404, `Contenedor ${normalizar(numero)} no encontrado`);
  return contenedor;
}

export async function crear(datos) {
  const error = validarNumero(datos.numeroContenedor);
  if (error) throw new HttpError(400, error);
  validarDatos(datos);
  const numero = normalizar(datos.numeroContenedor);
  await Contenedor.create({ ...datos, numeroContenedor: numero });
  return Contenedor.findByNumero(numero);
}

export async function actualizar(numero, datos) {
  validarDatos(datos, true);
  const actual = await obtener(numero);
  const cambios = await Contenedor.update(actual.id, datos);
  if (cambios === 0) throw new HttpError(400, 'No se envio ningun campo para actualizar');
  return Contenedor.findByNumero(actual.numeroContenedor);
}

export async function eliminar(numero) {
  const actual = await obtener(numero);
  await Contenedor.remove(actual.id);
}

export async function historial(numero) {
  const actual = await obtener(numero);
  return Contenedor.findHistorial(actual.id);
}

export async function registrarMovimiento(numero, d) {
  const actual = await obtener(numero);
  if (!ESTADO_POR_EVENTO[d.evento]) {
    throw new HttpError(400, `evento debe ser uno de: ${Object.keys(ESTADO_POR_EVENTO).join(', ')}`);
  }
  if (d.puerto != null && !/^[A-Z]{5}$/.test(d.puerto)) {
    throw new HttpError(400, 'puerto debe ser un codigo UN/LOCODE de 5 letras');
  }
  if (d.embarcacionImo != null && !/^\d{7}$/.test(d.embarcacionImo)) {
    throw new HttpError(400, 'embarcacionImo debe tener 7 digitos');
  }
  await Contenedor.addMovimiento(actual.id, { ...d, nuevoEstado: ESTADO_POR_EVENTO[d.evento] });
  return Contenedor.findHistorial(actual.id);
}
