/* Catalogos y utilidades compartidas por todas las pantallas */

export const ESTADOS = {
  REGISTRADO:  { label: 'Registrado',  cls: 'new' },
  EN_PUERTO:   { label: 'En puerto',   cls: 'port' },
  EN_TRANSITO: { label: 'En tránsito', cls: 'transit' },
  EN_ADUANA:   { label: 'En aduana',   cls: 'review' },
  ENTREGADO:   { label: 'Entregado',   cls: 'done' },
};

export const EVENTOS = {
  REGISTRO: 'Registro',
  CARGA:    'Carga a bordo',
  SALIDA:   'Salida de puerto',
  ARRIBO:   'Arribo',
  DESCARGA: 'Descarga',
  ADUANA:   'Revisión aduanal',
  ENTREGA:  'Entrega',
};

// Mismas reglas que el backend (services/contenedores.service.js): que evento sigue segun el estado
export const EVENTOS_PERMITIDOS = {
  REGISTRADO: ['CARGA', 'ADUANA'],
  EN_PUERTO: ['CARGA', 'SALIDA', 'DESCARGA', 'ADUANA', 'ENTREGA'],
  EN_TRANSITO: ['ARRIBO'],
  EN_ADUANA: ['CARGA', 'ENTREGA'],
  ENTREGADO: [],
};

// Filtra los eventos que realmente aplican segun si el contenedor esta a bordo o no
// `historial` (mas reciente primero) permite saber si ya arribo tras la ultima carga
export function eventosDisponibles(c, historial = []) {
  const abordo = Boolean(c.embarcacionImo);
  const ultimo = historial.find((h) => h.evento === 'CARGA' || h.evento === 'ARRIBO');
  const yaArribo = ultimo?.evento === 'ARRIBO';
  return (EVENTOS_PERMITIDOS[c.estado] ?? []).filter((e) => {
    if (e === 'SALIDA') return abordo && !yaArribo;
    if (e === 'DESCARGA') return abordo;
    if (e === 'ADUANA' || e === 'ENTREGA') return !abordo;
    if (e === 'CARGA') return !abordo;
    return true;
  });
}

export const TIPOS = {
  '20GP': '20 pies estándar',
  '40GP': '40 pies estándar',
  '40HC': '40 pies high cube',
  '20RF': '20 pies refrigerado',
  '40RF': '40 pies refrigerado',
};

// Mensaje de error de la API con sus detalles de validacion, si los hay
export function errorTexto(err) {
  return err.detalles?.length ? `${err.message}: ${err.detalles.join(' · ')}` : err.message;
}

export const ROLES = { ADMIN: 'Administrador', OPERADOR: 'Operador', CONSULTA: 'Consulta' };
export const puedeEditar = (u) => u?.rol === 'ADMIN' || u?.rol === 'OPERADOR';

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const iniciales = (nombre = '') =>
  nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export const dosDigitos = (n) => String(n).padStart(2, '0');
export const numero = (n) => (n ?? 0).toLocaleString('es-MX');

export const fechaCorta = (d) =>
  new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

export const fechaHora = (d) =>
  new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function haceCuanto(fecha) {
  const seg = Math.round((Date.now() - new Date(fecha)) / 1000);
  if (seg < 60) return 'Hace un momento';
  const min = Math.round(seg / 60);
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `Hace ${h} h`;
  const dias = Math.round(h / 24);
  return dias < 60 ? `Hace ${dias} días` : fechaCorta(fecha);
}

/* ---------- ISO 6346 (igual que el backend) ---------- */
const VALOR_LETRA = {};
for (let i = 0, v = 10; i < 26; i++, v++) {
  if (v % 11 === 0) v++;
  VALOR_LETRA[String.fromCharCode(65 + i)] = v;
}

export function digitoControl(diez) {
  let suma = 0;
  for (let i = 0; i < 10; i++) {
    const c = diez[i];
    suma += (/[A-Z]/.test(c) ? VALOR_LETRA[c] : Number(c)) * 2 ** i;
  }
  return (suma % 11) % 10;
}

// Devuelve { ok, mensaje } para mostrar ayuda mientras se escribe
export function revisarNumero(valor) {
  const n = valor.trim().toUpperCase();
  if (!n) return { ok: false, mensaje: null };
  if (!/^[A-Z]{0,3}$|^[A-Z]{3}[UJZ]\d{0,7}$/.test(n)) {
    return { ok: false, mensaje: 'Formato: 3 letras del dueño, U/J/Z y 7 dígitos (ej. MSCU1234566)' };
  }
  if (n.length < 10) return { ok: false, mensaje: null };
  const esperado = digitoControl(n);
  if (n.length === 10) return { ok: false, mensaje: `El dígito de control debe ser ${esperado} → ${n}${esperado}` };
  if (Number(n[10]) !== esperado) return { ok: false, mensaje: `Dígito de control incorrecto: debe ser ${esperado} (${n.slice(0, 10)}${esperado})` };
  return { ok: true, mensaje: 'Número válido' };
}

/* ---------- Mapa: vista centrada en el Pacifico ---------- */
// Longitudes de 0 a 360, asi las rutas Asia -> America se dibujan continuas
export const P = (lat, lng) => [lat, lng < 0 ? lng + 360 : lng];

// Evita saltos de mas de 180 grados entre puntos consecutivos de una ruta
export function unirAntimeridiano(puntos) {
  const out = [];
  for (const [lat, lng] of puntos) {
    let l = lng;
    if (out.length) {
      const prev = out[out.length - 1][1];
      while (l - prev > 180) l -= 360;
      while (l - prev < -180) l += 360;
    }
    out.push([lat, l]);
  }
  return out;
}

export function exportarCSV(filas, nombreArchivo = 'containertrack-contenedores.csv') {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = [
    ['Numero', 'Tipo', 'Naviera', 'Origen', 'Destino', 'Estado', 'Embarcacion', 'Registro'],
    ...filas.map((c) => [
      c.numeroContenedor, c.tipoContenedor, c.naviera, c.puertoOrigenNombre, c.puertoDestinoNombre,
      ESTADOS[c.estado]?.label ?? c.estado, c.embarcacionNombre ?? '', fechaCorta(c.fechaRegistro),
    ]),
  ].map((fila) => fila.map(celda).join(','));
  // BOM para que Excel respete los acentos
  const url = URL.createObjectURL(new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}
