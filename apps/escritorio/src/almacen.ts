/**
 * Guarda la base (bytes del .sqlite) y la configuración del distribuidor en IndexedDB.
 * En la app de Windows, IndexedDB vive en la carpeta del usuario (perfil de WebView2):
 * no hace falta permiso de administrador ni acceso a otras carpetas.
 */
const NOMBRE = 'albamix';
const TIENDA = 'datos';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const req = indexedDB.open(NOMBRE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TIENDA);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const tx = db.transaction(TIENDA, modo);
    const req = f(tx.objectStore(TIENDA));
    tx.oncomplete = () => { db.close(); ok(req.result); };
    tx.onerror = () => { db.close(); mal(tx.error); };
  });
}

export const leer = <T>(clave: string) => operar<T | undefined>('readonly', (s) => s.get(clave) as IDBRequest<T | undefined>);
export const guardar = (clave: string, valor: unknown) => operar('readwrite', (s) => s.put(valor, clave));

export interface Configuracion {
  /** Rentabilidad que se aplica si el producto no tiene una propia, en %. */
  rentabilidadGlobal: number;
  /** Peso mínimo confiable de la balanza, en gramos. */
  umbralGramos: number;
}
export const CONFIG_INICIAL: Configuracion = { rentabilidadGlobal: 0, umbralGramos: 2 };
