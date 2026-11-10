import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Valores de prueba: las pruebas nunca usan tu .env ni tu base de datos real
    env: { JWT_SECRET: 'secreto-de-pruebas-con-mas-de-32-caracteres-123', SESSION_HOURS: '8', NODE_ENV: 'test', SIMULADOR_ACTIVO: 'false', TRUST_PROXY: '1' },
  },
});
