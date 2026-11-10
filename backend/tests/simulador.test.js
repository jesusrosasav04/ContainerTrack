import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/db.js', () => ({ getPool: vi.fn(), sql: {} }));
const { distanciaMN, puntoIntermedio, rumbo } = await import('../src/services/simulador.service.js');

describe('navegación', () => {
  it('calcula la distancia Shanghái - Manzanillo (~6,800 millas náuticas)', () => {
    const d = distanciaMN(31.2304, 121.4737, 19.0524, -104.3158);
    expect(d).toBeGreaterThan(6700);
    expect(d).toBeLessThan(6900);
  });
  it('el punto a mitad de camino está a la mitad de la distancia', () => {
    const [lat, lon] = puntoIntermedio(24.6, -170.3, 19.0524, -104.3158, 0.5);
    const total = distanciaMN(24.6, -170.3, 19.0524, -104.3158);
    expect(distanciaMN(24.6, -170.3, lat, lon)).toBeCloseTo(total / 2, 0);
  });
  it('cruza el meridiano 180 sin desviarse', () => {
    const [, lon] = puntoIntermedio(27.4, 165.8, 24.6, -170.3, 0.5);
    expect(Math.abs(lon)).toBeGreaterThan(170);
  });
  it('el rumbo hacia el este es cercano a 90°', () => {
    const r = rumbo(0, 0, 0, 10);
    expect(r).toBeGreaterThanOrEqual(89);
    expect(r).toBeLessThanOrEqual(91);
  });
});
