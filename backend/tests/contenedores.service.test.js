import { beforeEach, describe, expect, it, vi } from 'vitest';

// La capa de datos se simula: se prueban solo las reglas de negocio
vi.mock('../src/models/contenedor.model.js', () => ({
  findByNumero: vi.fn(),
  findHistorial: vi.fn(),
  addMovimiento: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findAll: vi.fn(),
  remove: vi.fn(),
}));

const Contenedor = await import('../src/models/contenedor.model.js');
const servicio = await import('../src/services/contenedores.service.js');

const base = {
  id: 1, numeroContenedor: 'MSCU1234566', tipoContenedor: '40HC', naviera: 'MSC',
  puertoOrigenCodigo: 'CNSHA', puertoDestinoCodigo: 'MXZLO', embarcacionImo: null, estado: 'REGISTRADO',
};
const conEstado = (cambios) => Contenedor.findByNumero.mockResolvedValue({ ...base, ...cambios });

beforeEach(() => {
  vi.clearAllMocks();
  Contenedor.findHistorial.mockResolvedValue([]);
});

describe('validación ISO 6346', () => {
  it('acepta números válidos, incluido el ejemplo oficial', () => {
    expect(servicio.validarNumero('MSCU1234566')).toBeNull();
    expect(servicio.validarNumero('CSQU3054383')).toBeNull();
  });
  it('indica el dígito correcto cuando falla', () => {
    expect(servicio.validarNumero('MSCU1234567')).toMatch(/deberia ser 6/);
  });
  it('rechaza formatos inválidos', () => {
    expect(servicio.validarNumero('MSC1234566')).toMatch(/Formato/);
    expect(servicio.validarNumero(undefined)).toMatch(/obligatorio/);
  });
});

describe('alta y edición', () => {
  it('ignora estado y embarcación enviados al crear: todo contenedor nace REGISTRADO', async () => {
    Contenedor.findByNumero.mockResolvedValue(base);
    await servicio.crear({ numeroContenedor: 'MSCU1234566', tipoContenedor: '40HC', naviera: 'MSC', puertoOrigen: 'CNSHA', puertoDestino: 'MXZLO', estado: 'ENTREGADO', embarcacionImo: '9800001' });
    const enviado = Contenedor.create.mock.calls[0][0];
    expect(enviado.estado).toBeUndefined();
    expect(enviado.embarcacionImo).toBeUndefined();
  });
  it('no permite cambiar el estado editando', async () => {
    await expect(servicio.actualizar('MSCU1234566', { estado: 'ENTREGADO' })).rejects.toMatchObject({ status: 400 });
  });
  it('no permite cambiar el origen después del primer movimiento', async () => {
    conEstado({ estado: 'EN_PUERTO' });
    await expect(servicio.actualizar('MSCU1234566', { puertoOrigen: 'SGSIN' })).rejects.toMatchObject({ status: 409 });
  });
});

describe('ciclo de vida de movimientos', () => {
  it('no permite registrar eventos en un contenedor entregado', async () => {
    conEstado({ estado: 'ENTREGADO' });
    await expect(servicio.registrarMovimiento('MSCU1234566', { evento: 'CARGA', embarcacionImo: '9800001' }))
      .rejects.toMatchObject({ status: 409 });
  });
  it('no permite zarpar sin estar a bordo', async () => {
    conEstado({ estado: 'EN_PUERTO' });
    await expect(servicio.registrarMovimiento('MSCU1234566', { evento: 'SALIDA' })).rejects.toMatchObject({ status: 409 });
  });
  it('no permite entregar mientras sigue a bordo', async () => {
    conEstado({ estado: 'EN_PUERTO', embarcacionImo: '9800001' });
    await expect(servicio.registrarMovimiento('MSCU1234566', { evento: 'ENTREGA' })).rejects.toMatchObject({ status: 409 });
  });
  it('no permite volver a zarpar después del arribo', async () => {
    conEstado({ estado: 'EN_PUERTO', embarcacionImo: '9800001' });
    Contenedor.findHistorial.mockResolvedValue([{ evento: 'ARRIBO' }, { evento: 'SALIDA' }, { evento: 'CARGA' }]);
    await expect(servicio.registrarMovimiento('MSCU1234566', { evento: 'SALIDA' })).rejects.toMatchObject({ status: 409 });
  });
  it('la carga exige una embarcación', async () => {
    conEstado({});
    await expect(servicio.registrarMovimiento('MSCU1234566', { evento: 'CARGA' })).rejects.toMatchObject({ status: 400 });
  });
  it('una carga válida usa el puerto de origen y deja el contenedor EN_PUERTO', async () => {
    conEstado({});
    await servicio.registrarMovimiento('MSCU1234566', { evento: 'CARGA', embarcacionImo: '9800001' });
    expect(Contenedor.addMovimiento).toHaveBeenCalledWith(1, expect.objectContaining({
      evento: 'CARGA', puerto: 'CNSHA', embarcacionImo: '9800001', nuevoEstado: 'EN_PUERTO',
    }));
  });
  it('la salida deja el contenedor EN_TRANSITO', async () => {
    conEstado({ estado: 'EN_PUERTO', embarcacionImo: '9800001' });
    Contenedor.findHistorial.mockResolvedValue([{ evento: 'CARGA' }]);
    await servicio.registrarMovimiento('MSCU1234566', { evento: 'SALIDA' });
    expect(Contenedor.addMovimiento).toHaveBeenCalledWith(1, expect.objectContaining({ nuevoEstado: 'EN_TRANSITO' }));
  });
});
