/**
 * Lector de bases Access 1.x (motor Jet 1.x, el que usa Visual Basic 3).
 *
 * Las .mdb de Albamix tienen la página 0 (cabecera) sobrescrita, por eso ninguna herramienta
 * estándar las abre. Este lector no usa la cabecera: recorre las páginas de 2 KB, arranca por
 * el catálogo del sistema (MSysColumns, MSysObjects) y descubre solo las tablas y columnas.
 *
 * Formato deducido por ingeniería inversa (ver docs/ESPECIFICACION_ALBAMIX.md):
 * - Página de datos: tipo 0x06 en el byte 0, página de definición de la tabla en 4..7,
 *   cantidad de filas en 8..9, tabla de offsets desde 0x14 (bit 0x1000 = fila viva).
 * - Fila: [largo u16][n.º columnas fijas][n.º columnas variables][fijas en orden][variables]
 *   y una cola invertida: [fin de datos][offset var n-1 … var 0][n.º var][máscara de nulos].
 * - El id de cada objeto en MSysObjects es también el número de su página de definición.
 */

const PAGINA = 2048;
const TIPO_DATOS = 0x06;
const FILA_VIVA = 0x1000;
const ID_MSYSOBJECTS = 3;
const ID_MSYSCOLUMNS = 4;
const textoCp1252 = new TextDecoder('windows-1252');

export enum TipoColumna {
  Booleano = 1, Byte = 2, Entero = 3, EnteroLargo = 4, Moneda = 5, Simple = 6, Doble = 7,
  Fecha = 8, Texto = 10, Ole = 11, Memo = 12,
}

export interface Columna {
  nombre: string;
  tipo: number;
  /** Tamaño en bytes (fijas) o largo máximo declarado (texto). */
  tamano: number;
  /** ≥ 0: posición entre las columnas fijas. < 0: posición entre las variables (-1 es la primera). */
  indice: number;
}

export interface Tabla {
  id: number;
  nombre: string;
  columnas: Columna[];
}

export type Valor = string | number | boolean | Date | Uint8Array | null;
export type Fila = Record<string, Valor>;

export class ErrorJet1 extends Error {}

export class BaseJet1 {
  private readonly datos: Uint8Array;
  private readonly vista: DataView;
  private readonly paginasPorTabla = new Map<number, number[]>();
  private tablasCache?: Map<string, Tabla>;

  constructor(contenido: Uint8Array) {
    if (contenido.length < PAGINA * 4 || contenido.length % PAGINA !== 0) {
      throw new ErrorJet1('El archivo no tiene el tamaño de una base Access 1.x (páginas de 2 KB).');
    }
    this.datos = contenido;
    this.vista = new DataView(contenido.buffer, contenido.byteOffset, contenido.byteLength);
    for (let p = 1; p < contenido.length / PAGINA; p++) {
      const o = p * PAGINA;
      if (contenido[o] !== TIPO_DATOS) continue;
      const tdef = this.vista.getUint32(o + 4, true);
      const lista = this.paginasPorTabla.get(tdef) ?? [];
      lista.push(p);
      this.paginasPorTabla.set(tdef, lista);
    }
    if (!this.paginasPorTabla.has(ID_MSYSCOLUMNS) || !this.paginasPorTabla.has(ID_MSYSOBJECTS)) {
      throw new ErrorJet1('No se encontró el catálogo del sistema (MSysObjects / MSysColumns).');
    }
  }

  /** Tablas de usuario (sin las MSys…), por nombre. */
  tablas(): Map<string, Tabla> {
    if (this.tablasCache) return this.tablasCache;
    const columnasPorObjeto = this.leerCatalogoColumnas();
    const colsObjetos = columnasPorObjeto.get(ID_MSYSOBJECTS);
    if (!colsObjetos) throw new ErrorJet1('Falta la definición de MSysObjects.');

    const tablas = new Map<string, Tabla>();
    for (const fila of this.filasDe(ID_MSYSOBJECTS, colsObjetos)) {
      const id = fila.Id, nombre = fila.Name, tipo = fila.Type;
      if (typeof id !== 'number' || typeof nombre !== 'string' || tipo !== 1) continue;
      if (nombre.startsWith('MSys')) continue;
      const columnas = columnasPorObjeto.get(id);
      if (columnas) tablas.set(nombre, { id, nombre, columnas });
    }
    this.tablasCache = tablas;
    return tablas;
  }

  /** Filas vivas de una tabla de usuario. El nombre no distingue mayúsculas. */
  leerTabla(nombre: string): Fila[] {
    const t = [...this.tablas().values()].find((x) => x.nombre.toLowerCase() === nombre.toLowerCase());
    if (!t) throw new ErrorJet1(`La base no tiene la tabla ${nombre}.`);
    return [...this.filasDe(t.id, t.columnas)];
  }

  // ---------- catálogo ----------

  /** MSysColumns tiene diseño fijo conocido: se lee sin catálogo previo. */
  private leerCatalogoColumnas(): Map<number, Columna[]> {
    const porObjeto = new Map<number, Columna[]>();
    for (const r of this.filasCrudas(ID_MSYSCOLUMNS)) {
      const objeto = leerU32(r, 4);
      const indice = (r[10]! << 24) >> 24; // con signo: 0xFF = -1 (primera variable)
      const tamano = r[11]!, tipo = r[12]!;
      const vars = columnasVariables(r);
      const nombre = vars[0] !== undefined ? textoCp1252.decode(vars[0]) : '';
      if (!nombre) continue;
      const lista = porObjeto.get(objeto) ?? [];
      lista.push({ nombre, tipo, tamano, indice });
      porObjeto.set(objeto, lista);
    }
    return porObjeto;
  }

  // ---------- filas ----------

  private *filasDe(tdef: number, columnas: Columna[]): Generator<Fila> {
    const fijas = columnas.filter((c) => c.indice >= 0).sort((a, b) => a.indice - b.indice);
    const variables = columnas.filter((c) => c.indice < 0).sort((a, b) => b.indice - a.indice);
    for (const r of this.filasCrudas(tdef)) yield decodificarFila(r, fijas, variables);
  }

  private *filasCrudas(tdef: number): Generator<Uint8Array> {
    for (const p of this.paginasPorTabla.get(tdef) ?? []) {
      const o = p * PAGINA;
      const pagina = this.datos.subarray(o, o + PAGINA);
      const n = leerU16(pagina, 8);
      const offsets: number[] = [];
      for (let i = 0; i < n; i++) offsets.push(leerU16(pagina, 0x14 + 2 * i));
      const inicios = [...new Set(offsets.map((x) => x & 0x7ff).filter((x) => x > 0))].sort((a, b) => a - b);
      for (const off of offsets) {
        if (!(off & FILA_VIVA)) continue;
        const ini = off & 0x7ff;
        const fin = inicios.find((x) => x > ini) ?? PAGINA;
        const fila = pagina.subarray(ini, fin);
        const largo = leerU16(fila, 0);
        if (largo < 4 || largo > fila.length) throw new ErrorJet1(`Fila dañada en la página ${p}.`);
        yield fila.subarray(0, largo);
      }
    }
  }
}

function decodificarFila(r: Uint8Array, fijas: Columna[], variables: Columna[]): Fila {
  const fila: Fila = {};
  const nFijas = r[2]!;
  let pos = 4;
  fijas.forEach((c, i) => {
    if (i >= nFijas) { fila[c.nombre] = null; return; }
    fila[c.nombre] = convertir(r.subarray(pos, pos + c.tamano), c.tipo);
    pos += c.tamano;
  });
  const vars = columnasVariables(r);
  variables.forEach((c, i) => {
    const bytes = vars[i];
    fila[c.nombre] = bytes === undefined ? null : convertir(bytes, c.tipo);
  });
  return fila;
}

/** Devuelve los bytes de cada columna variable presente en la fila, en orden. */
function columnasVariables(r: Uint8Array): Uint8Array[] {
  const L = r.length;
  const nFijas = r[2]!;
  const largoMascara = Math.max(1, Math.ceil(nFijas / 8));
  const nVar = r[L - largoMascara - 1]!;
  const limites: number[] = [];
  for (let i = 0; i < nVar; i++) limites.push(r[L - largoMascara - 2 - i]!);
  limites.push(r[L - largoMascara - 2 - nVar]!); // fin de datos
  const out: Uint8Array[] = [];
  for (let i = 0; i < nVar; i++) out.push(r.subarray(limites[i]!, limites[i + 1]!));
  return out;
}

function convertir(b: Uint8Array, tipo: number): Valor {
  if (tipo === TipoColumna.Texto || tipo === TipoColumna.Memo) return textoCp1252.decode(b).replace(/\s+$/, '');
  if (b.length === 0) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  switch (tipo) {
    case TipoColumna.Booleano: return b[0] !== 0;
    case TipoColumna.Byte: return b[0]!;
    case TipoColumna.Entero: return v.getInt16(0, true);
    case TipoColumna.EnteroLargo: return v.getInt32(0, true);
    case TipoColumna.Moneda: return Number(v.getBigInt64(0, true)) / 10000;
    case TipoColumna.Simple: return v.getFloat32(0, true);
    case TipoColumna.Doble: return v.getFloat64(0, true);
    case TipoColumna.Fecha: return fechaOle(v.getFloat64(0, true));
    default: return b.slice();
  }
}

/** Fecha OLE de Access: días desde el 30/12/1899. Se devuelve a medianoche UTC. */
function fechaOle(dias: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(dias * 86400000));
}

function leerU16(b: Uint8Array, o: number): number { return b[o]! | (b[o + 1]! << 8); }
function leerU32(b: Uint8Array, o: number): number { return (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16)) + b[o + 3]! * 0x1000000; }
