import { useCallback, useEffect, useRef, useState } from 'react';

/* Carga datos y los vuelve a pedir cada `intervaloMs` mientras la pestana esta visible.
   Al volver a la pestana, refresca de inmediato. Devuelve:
   { datos, error, cargando, actualizado, recargar } */
export function useAutoRefresh(cargarFn, intervaloMs = 30000) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [actualizado, setActualizado] = useState(null);
  const fnRef = useRef(cargarFn);
  useEffect(() => { fnRef.current = cargarFn; });
  const enCurso = useRef(false);

  const recargar = useCallback(async ({ silencioso = false } = {}) => {
    if (enCurso.current) return;
    enCurso.current = true;
    if (!silencioso) setCargando(true);
    try {
      setDatos(await fnRef.current());
      setError(null);
      setActualizado(new Date());
    } catch (err) {
      // En una recarga automatica fallida se conservan los datos anteriores
      setError(err.message);
    } finally {
      enCurso.current = false;
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') recargar({ silencioso: true });
    }, intervaloMs);
    const alVolver = () => { if (document.visibilityState === 'visible') recargar({ silencioso: true }); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [recargar, intervaloMs]);

  return { datos, error, cargando, actualizado, recargar };
}
