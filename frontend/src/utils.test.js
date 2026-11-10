import { describe, expect, it } from 'vitest';
import { digitoControl, eventosDisponibles, revisarNumero, unirAntimeridiano, P } from './utils.js';

describe('ISO 6346', () => {
  it('calcula el dígito de control de números conocidos', () => {
    expect(digitoControl('CSQU305438')).toBe(3);   // ejemplo oficial de la norma
    expect(digitoControl('MSCU123456')).toBe(6);
  });
  it('acepta un número válido', () => {
    expect(revisarNumero('MSCU1234566').ok).toBe(true);
  });
  it('rechaza un dígito de control incorrecto y sugiere el correcto', () => {
    const r = revisarNumero('MSCU1234567');
    expect(r.ok).toBe(false);
    expect(r.mensaje).toContain('6');
  });
  it('rechaza formatos inválidos', () => {
    expect(revisarNumero('MSCX1234566').ok).toBe(false);
    expect(revisarNumero('12341234566').ok).toBe(false);
  });
});

describe('eventos disponibles', () => {
  it('un contenedor recién registrado solo puede cargarse o pasar aduana', () => {
    expect(eventosDisponibles({ estado: 'REGISTRADO' })).toEqual(['CARGA', 'ADUANA']);
  });
  it('a bordo en el puerto de origen puede zarpar o descargarse', () => {
    expect(eventosDisponibles({ estado: 'EN_PUERTO', embarcacionImo: '9800001' }, [{ evento: 'CARGA' }])).toEqual(['SALIDA', 'DESCARGA']);
  });
  it('tras el arribo ya no puede volver a zarpar', () => {
    expect(eventosDisponibles({ estado: 'EN_PUERTO', embarcacionImo: '9800001' }, [{ evento: 'ARRIBO' }, { evento: 'CARGA' }])).toEqual(['DESCARGA']);
  });
  it('un contenedor entregado no admite eventos', () => {
    expect(eventosDisponibles({ estado: 'ENTREGADO' })).toEqual([]);
  });
});

describe('mapa centrado en el Pacífico', () => {
  it('convierte longitudes oeste a 0-360', () => {
    expect(P(19, -104)).toEqual([19, 256]);
  });
  it('una ruta que cruza el meridiano 180 no da la vuelta al mundo', () => {
    const r = unirAntimeridiano([[30, 170], [25, -170]]);
    expect(Math.abs(r[1][1] - r[0][1])).toBeLessThan(180);
  });
});
