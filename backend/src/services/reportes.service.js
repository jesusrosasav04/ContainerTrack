/* =========================================================
   Reportes PDF (pdfkit). Fuente Helvetica estandar: soporta acentos y ñ,
   pero no simbolos como flechas; por eso las rutas se escriben "Origen » Destino".
   ========================================================= */
import PDFDocument from 'pdfkit';

const TZ = process.env.TZ_REPORTES || 'America/Mexico_City';
const C = {
  marca: '#0e9e99', serie2: '#3b6fb6', texto: '#172b3a', suave: '#5d7280',
  tenue: '#8a9ba7', linea: '#e1e8ec', fondo: '#f4f7fa', banda: '#071827',
};
export const ESTADOS = {
  REGISTRADO: 'Registrado', EN_PUERTO: 'En puerto', EN_TRANSITO: 'En tránsito', EN_ADUANA: 'En aduana', ENTREGADO: 'Entregado',
};
export const EVENTOS = {
  REGISTRO: 'Registro', CARGA: 'Carga a bordo', SALIDA: 'Salida de puerto', ARRIBO: 'Arribo',
  DESCARGA: 'Descarga', ADUANA: 'Revisión aduanal', ENTREGA: 'Entrega',
};
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export const fecha = (d) => new Date(d).toLocaleDateString('es-MX', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
export const fechaHora = (d) => new Date(d).toLocaleString('es-MX', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const num = (n) => (n ?? 0).toLocaleString('es-MX');

/* ---------- Documento base ---------- */
function crearDocumento(res, { titulo, archivo, horizontal = false }) {
  const doc = new PDFDocument({
    size: 'LETTER',
    layout: horizontal ? 'landscape' : 'portrait',
    margins: { top: 48, bottom: 56, left: 48, right: 48 },
    bufferPages: true,                       // para numerar "Pagina X de Y" al final
    info: { Title: titulo, Author: 'ContainerTrack', Creator: 'ContainerTrack' },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${archivo}"`);
  res.setHeader('Cache-Control', 'no-store');   // contiene datos operativos
  doc.pipe(res);
  return doc;
}

const ancho = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;
const izq = (doc) => doc.page.margins.left;
const limiteInferior = (doc) => doc.page.height - doc.page.margins.bottom;

function encabezado(doc, titulo, subtitulo, usuario) {
  const x = izq(doc);
  const w = ancho(doc);
  doc.rect(0, 0, doc.page.width, 6).fill(C.marca);
  doc.font('Helvetica-Bold').fontSize(15).fillColor(C.texto).text('Container', x, 26, { continued: true })
    .fillColor(C.marca).text('Track');
  doc.font('Helvetica').fontSize(8).fillColor(C.tenue)
    .text(`Generado: ${fechaHora(new Date())}${usuario ? `  ·  ${usuario.nombre}` : ''}`, x, 30, { width: w, align: 'right' });
  doc.moveTo(x, 50).lineTo(x + w, 50).lineWidth(0.6).strokeColor(C.linea).stroke();
  doc.font('Helvetica-Bold').fontSize(18).fillColor(C.texto).text(titulo, x, 64, { width: w });
  if (subtitulo) doc.font('Helvetica').fontSize(9.5).fillColor(C.suave).text(subtitulo, x, doc.y + 2, { width: w });
  doc.moveDown(1.2);
}

function seccion(doc, texto) {
  asegurarEspacio(doc, 40);
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.texto).text(texto, izq(doc), doc.y);
  doc.moveDown(0.4);
}

function asegurarEspacio(doc, alto) {
  if (doc.y + alto > limiteInferior(doc)) doc.addPage();
}

// Numera todas las paginas al terminar
function pieDePagina(doc) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    const inferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;             // permite escribir en el margen sin crear pagina nueva
    doc.font('Helvetica').fontSize(7.5).fillColor(C.tenue)
      .text(`ContainerTrack · Datos simulados (Nivel 1)`, izq(doc), doc.page.height - 34, { width: ancho(doc), align: 'left', lineBreak: false })
      .text(`Página ${i - start + 1} de ${count}`, izq(doc), doc.page.height - 34, { width: ancho(doc), align: 'right', lineBreak: false });
    doc.page.margins.bottom = inferior;
  }
}

/* ---------- Tabla con salto de pagina y encabezado repetido ---------- */
function tabla(doc, columnas, filas, { tamano = 8.5 } = {}) {
  const x0 = izq(doc);
  const totalPeso = columnas.reduce((s, c) => s + c.peso, 0);
  const cols = columnas.map((c) => ({ ...c, w: (c.peso / totalPeso) * ancho(doc) }));
  const altoFila = tamano + 10;

  const dibujarEncabezado = () => {
    const y = doc.y;
    doc.rect(x0, y, ancho(doc), altoFila).fill(C.fondo);
    let x = x0;
    doc.font('Helvetica-Bold').fontSize(tamano - 1).fillColor(C.suave);
    for (const c of cols) {
      doc.text(c.titulo.toUpperCase(), x + 5, y + 5, { width: c.w - 10, height: tamano, align: c.align ?? 'left', lineBreak: false, ellipsis: true });
      x += c.w;
    }
    doc.y = y + altoFila;
  };

  dibujarEncabezado();
  if (!filas.length) {
    doc.font('Helvetica').fontSize(tamano).fillColor(C.tenue).text('Sin registros.', x0 + 5, doc.y + 6);
    doc.moveDown(0.5);
    return;
  }
  filas.forEach((fila) => {
    if (doc.y + altoFila > limiteInferior(doc)) { doc.addPage(); dibujarEncabezado(); }
    const y = doc.y;
    let x = x0;
    doc.font('Helvetica').fontSize(tamano).fillColor(C.texto);
    for (const c of cols) {
      const valor = c.valor(fila);
      doc.font(c.negrita ? 'Helvetica-Bold' : 'Helvetica')
        .text(String(valor ?? '—'), x + 5, y + 5, { width: c.w - 10, height: tamano + 1, align: c.align ?? 'left', lineBreak: false, ellipsis: true });
      x += c.w;
    }
    doc.moveTo(x0, y + altoFila).lineTo(x0 + ancho(doc), y + altoFila).lineWidth(0.4).strokeColor(C.linea).stroke();
    doc.y = y + altoFila;
  });
  doc.x = x0;
}

function datosClaveValor(doc, pares) {
  const x0 = izq(doc);
  const colW = ancho(doc) / 2;
  for (let i = 0; i < pares.length; i += 2) {
    asegurarEspacio(doc, 34);
    const y = doc.y;
    [pares[i], pares[i + 1]].forEach((par, j) => {
      if (!par) return;
      doc.font('Helvetica').fontSize(7.5).fillColor(C.tenue).text(par[0].toUpperCase(), x0 + j * colW, y, { width: colW - 12 });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.texto).text(String(par[1] ?? '—'), x0 + j * colW, y + 11, { width: colW - 12, height: 12, lineBreak: false, ellipsis: true });
    });
    doc.y = y + 30;
  }
  doc.x = x0;
}

/* ---------- Reporte: ficha de un contenedor ---------- */
export function fichaContenedor(res, { contenedor: c, historial, usuario }) {
  const doc = crearDocumento(res, { titulo: `Contenedor ${c.numeroContenedor}`, archivo: `contenedor-${c.numeroContenedor}.pdf` });
  encabezado(doc, `Contenedor ${c.numeroContenedor}`, 'Ficha de seguimiento e historial de movimientos', usuario);
  datosClaveValor(doc, [
    ['Estado actual', ESTADOS[c.estado] ?? c.estado],
    ['Tipo', c.tipoContenedor],
    ['Naviera', c.naviera],
    ['Embarcación actual', c.embarcacionNombre ? `${c.embarcacionNombre} (IMO ${c.embarcacionImo})` : 'En tierra'],
    ['Origen', `${c.puertoOrigenNombre} (${c.puertoOrigenCodigo})`],
    ['Destino', `${c.puertoDestinoNombre} (${c.puertoDestinoCodigo})`],
    ['Fecha de registro', fecha(c.fechaRegistro)],
    ['Movimientos registrados', historial.length],
  ]);
  seccion(doc, 'Historial de movimientos');
  // Orden cronologico para lectura en papel
  tabla(doc, [
    { titulo: 'Fecha', peso: 2.2, valor: (h) => fechaHora(h.fechaEvento) },
    { titulo: 'Evento', peso: 1.8, valor: (h) => EVENTOS[h.evento] ?? h.evento, negrita: true },
    { titulo: 'Puerto', peso: 1.8, valor: (h) => h.puertoNombre },
    { titulo: 'Embarcación', peso: 1.8, valor: (h) => h.embarcacionNombre },
    { titulo: 'Nota', peso: 3, valor: (h) => h.descripcion },
  ], [...historial].reverse());
  pieDePagina(doc);
  doc.end();
}

/* ---------- Reporte: listado de contenedores ---------- */
export function listadoContenedores(res, { contenedores, filtros, usuario }) {
  const doc = crearDocumento(res, { titulo: 'Listado de contenedores', archivo: 'contenedores.pdf', horizontal: true });
  const partes = [];
  if (filtros.estado) partes.push(`Estado: ${filtros.estado === 'ACTIVOS' ? 'activos (sin entregar)' : ESTADOS[filtros.estado] ?? filtros.estado}`);
  if (filtros.q) partes.push(`Búsqueda: "${filtros.q}"`);
  encabezado(doc, 'Listado de contenedores', `${num(contenedores.length)} contenedores${partes.length ? ' · ' + partes.join(' · ') : ''}`, usuario);

  // Resumen por estado
  const conteo = Object.keys(ESTADOS).map((e) => [ESTADOS[e], contenedores.filter((c) => c.estado === e).length]).filter(([, n]) => n);
  doc.font('Helvetica').fontSize(9).fillColor(C.suave)
    .text(conteo.map(([e, n]) => `${e}: ${num(n)}`).join('     '), izq(doc), doc.y, { width: ancho(doc) });
  doc.moveDown(0.8);

  tabla(doc, [
    { titulo: 'Número', peso: 1.6, valor: (c) => c.numeroContenedor, negrita: true },
    { titulo: 'Tipo', peso: 0.8, valor: (c) => c.tipoContenedor },
    { titulo: 'Naviera', peso: 1.5, valor: (c) => c.naviera },
    { titulo: 'Origen', peso: 1.7, valor: (c) => c.puertoOrigenNombre },
    { titulo: 'Destino', peso: 1.7, valor: (c) => c.puertoDestinoNombre },
    { titulo: 'Estado', peso: 1.3, valor: (c) => ESTADOS[c.estado] ?? c.estado },
    { titulo: 'Embarcación', peso: 1.8, valor: (c) => c.embarcacionNombre ?? 'En tierra' },
    { titulo: 'Registro', peso: 1.3, valor: (c) => fecha(c.fechaRegistro), align: 'right' },
  ], contenedores, { tamano: 8 });
  pieDePagina(doc);
  doc.end();
}

/* ---------- Graficas vectoriales ---------- */
function graficaMensual(doc, porMes) {
  const x0 = izq(doc) + 26;
  const w = ancho(doc) - 26;
  const h = 150;
  asegurarEspacio(doc, h + 40);
  const y0 = doc.y + 6;
  const max = Math.max(1, ...porMes.flatMap((m) => [m.registrados, m.entregados]));
  const paso = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find((p) => max / p <= 5) ?? Math.ceil(max / 5);
  const tope = Math.ceil(max / paso) * paso;

  // Lineas de guia y eje
  doc.font('Helvetica').fontSize(7).fillColor(C.tenue);
  for (let v = 0; v <= tope; v += paso) {
    const y = y0 + h - (v / tope) * h;
    doc.moveTo(x0, y).lineTo(x0 + w, y).lineWidth(0.4).strokeColor(C.linea).stroke();
    doc.text(String(v), izq(doc), y - 3.5, { width: 20, align: 'right', lineBreak: false });
  }
  const grupo = w / 12;
  const barra = Math.min(12, grupo * 0.3);
  porMes.forEach((m, i) => {
    const cx = x0 + grupo * i + grupo / 2;
    [[m.registrados, C.marca, -barra - 1], [m.entregados, C.serie2, 1]].forEach(([v, color, dx]) => {
      const alto = (v / tope) * h;
      if (alto > 0) doc.roundedRect(cx + dx, y0 + h - alto, barra, alto, Math.min(2, alto / 2)).fill(color);
    });
    doc.font('Helvetica').fontSize(7).fillColor(C.suave).text(MESES[i], cx - 12, y0 + h + 4, { width: 24, align: 'center', lineBreak: false });
  });
  // Leyenda
  const ly = y0 + h + 18;
  doc.rect(x0, ly, 8, 8).fill(C.marca);
  doc.font('Helvetica').fontSize(8).fillColor(C.suave).text('Registrados', x0 + 12, ly, { lineBreak: false });
  doc.rect(x0 + 80, ly, 8, 8).fill(C.serie2);
  doc.fillColor(C.suave).text('Entregados', x0 + 92, ly, { lineBreak: false });
  doc.y = ly + 18;
  doc.x = izq(doc);
}

function ranking(doc, titulo, filas, etiqueta) {
  seccion(doc, titulo);
  if (!filas.length) {
    doc.font('Helvetica').fontSize(9).fillColor(C.tenue).text('Sin datos para este año.');
    return;
  }
  const x0 = izq(doc);
  const w = ancho(doc);
  const wEtiqueta = w * 0.36;
  const wValor = 40;
  const wBarra = w - wEtiqueta - wValor - 16;
  const max = Math.max(1, ...filas.map((f) => f.total));
  filas.forEach((f) => {
    asegurarEspacio(doc, 16);
    const y = doc.y;
    doc.font('Helvetica').fontSize(8.5).fillColor(C.texto).text(etiqueta(f), x0, y + 1, { width: wEtiqueta - 6, height: 10, lineBreak: false, ellipsis: true });
    const largo = Math.max(1.5, (f.total / max) * wBarra);
    doc.roundedRect(x0 + wEtiqueta, y + 1, largo, 9, 2).fill(C.marca);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.texto).text(num(f.total), x0 + w - wValor, y + 1, { width: wValor, align: 'right', lineBreak: false });
    doc.y = y + 15;
  });
  doc.x = x0;
}

function tarjetas(doc, items) {
  const x0 = izq(doc);
  const gap = 10;
  const w = (ancho(doc) - gap * (items.length - 1)) / items.length;
  const y = doc.y;
  items.forEach(([titulo, valor, pie], i) => {
    const x = x0 + i * (w + gap);
    doc.roundedRect(x, y, w, 62, 6).lineWidth(0.6).strokeColor(C.linea).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(C.suave).text(titulo, x + 10, y + 9, { width: w - 20, lineBreak: false, ellipsis: true });
    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.texto).text(String(valor), x + 10, y + 21, { width: w - 20, lineBreak: false });
    doc.font('Helvetica').fontSize(7).fillColor(C.tenue).text(pie, x + 10, y + 46, { width: w - 20, lineBreak: false, ellipsis: true });
  });
  doc.y = y + 74;
  doc.x = x0;
}

/* ---------- Reporte: estadisticas anuales ---------- */
export function reporteAnual(res, { datos: d, usuario }) {
  const r = d.resumen;
  const doc = crearDocumento(res, { titulo: `Reporte anual ${d.anio}`, archivo: `reporte-anual-${d.anio}.pdf` });
  encabezado(doc, `Reporte anual ${d.anio}`, 'Desempeño de la operación de contenedores', usuario);

  const variacion = r.registradosAnioAnterior > 0
    ? `${r.registrados >= r.registradosAnioAnterior ? '+' : ''}${Math.round(((r.registrados - r.registradosAnioAnterior) / r.registradosAnioAnterior) * 100)}% vs ${d.anio - 1}`
    : `Sin datos de ${d.anio - 1}`;
  tarjetas(doc, [
    [`Registrados en ${d.anio}`, num(r.registrados), variacion],
    [`Entregados en ${d.anio}`, num(r.entregados), 'Ciclos completados'],
    ['En tránsito (hoy)', num(r.enTransitoAhora), `${num(r.activosAhora)} activos en total`],
    ['Días promedio de navegación', r.diasTransitoPromedio ?? '—', 'De la salida al arribo'],
  ]);

  seccion(doc, 'Movimiento mensual');
  graficaMensual(doc, d.porMes);

  seccion(doc, 'Detalle mensual');
  tabla(doc, [
    { titulo: 'Mes', peso: 2, valor: (m) => MESES[m.mes - 1] },
    { titulo: 'Registrados', peso: 1.5, valor: (m) => num(m.registrados), align: 'right' },
    { titulo: 'Entregados', peso: 1.5, valor: (m) => num(m.entregados), align: 'right' },
  ], d.porMes, { tamano: 8 });

  ranking(doc, 'Contenedores por naviera', d.porNaviera, (f) => f.naviera);
  ranking(doc, 'Rutas más usadas', d.porRuta, (f) => `${f.origen} » ${f.destino}`);
  ranking(doc, 'Por tipo de contenedor', d.porTipo, (f) => f.tipo);
  ranking(doc, 'Estado actual de los registrados en el año', d.porEstado, (f) => ESTADOS[f.estado] ?? f.estado);

  pieDePagina(doc);
  doc.end();
}
