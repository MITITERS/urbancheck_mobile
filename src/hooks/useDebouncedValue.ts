import { useEffect, useState } from "react";

/**
 * Devuelve `value` retrasado `delay` ms.
 *
 * Se usa para que el feed y el mapa no disparen una petición por cada tecla de la
 * barra de búsqueda.
 */
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
