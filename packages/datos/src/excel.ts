import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { Componente, TipoComponente, Unidad } from '@albamix/core';

/** Encabezados de la planilla (mismo formato que el PESO_ESP del Albamix original). */
export const COLUMNAS_PRECIOS = ['Tipo', 'Código', 'Nombre', 'Peso Esp.', 'Precio 1', 'Capa. 1', 'Precio 2', 'Capa. 2', 'Unidad', 'Bonif.', 'Rentab.'] as const;

export interface DatosLista {
  vigencia?: string; // AAAA-MM-DD
  numero?: string;
  notas?: string;
}

export interface ErrorPlanilla {
  fila: number;
  columna?: string;
  mensaje: string;
}

export interface ListaPrecios extends DatosLista {
  productos: Componente[];
  errores: ErrorPlanilla[];
}

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Lee la planilla de precios. No lanza por errores de carga: los devuelve con fila y columna. */
export async function leerListaPrecios(contenido: Uint8Array | ArrayBuffer): Promise<ListaPrecios> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await sinComentarios(contenido));
  } catch {
    return { productos: [], errores: [{ fila: 0, mensaje: 'El archivo no es una planilla Excel (.xlsx) válida.' }] };
  }
  const ws = wb.getWorksheet('Precios') ?? wb.worksheets[0];
  const errores: ErrorPlanilla[] = [];
  if (!ws) return { productos: [], errores: [{ fila: 0, mensaje: 'La planilla no tiene hojas.' }] };

  // Encabezado: la fila que tiene "Código" (el formato admite filas de datos de la lista arriba).
  let filaEnc = 0;
  const col = new Map<string, number>();
  ws.eachRow((row, n) => {
    if (filaEnc) return;
    const vals = (row.values as unknown[]).map(norm);
    if (vals.includes('codigo')) {
      filaEnc = n;
      vals.forEach((v, i) => { if (v) col.set(v, i); });
    }
  });
  if (!filaEnc) return { productos: [], errores: [{ fila: 0, mensaje: 'No se encontró la fila de encabezados (con la columna "Código").' }] };
  const faltan = COLUMNAS_PRECIOS.slice(0, 9).filter((c) => !col.has(norm(c)));
  if (faltan.length) errores.push({ fila: filaEnc, mensaje: `Faltan columnas: ${faltan.join(', ')}.` });

  // Datos de la lista (celdas a la derecha de "Vigente desde:", "Número de lista:", "Notas:").
  const datos: DatosLista = {};
  for (let r = 1; r < filaEnc; r++) {
    const etiqueta = norm(ws.getCell(r, 1).value);
    const valor = valorCelda(ws.getCell(r, 2).value);
    if (etiqueta.startsWith('vigente') && valor instanceof Date) datos.vigencia = valor.toISOString().slice(0, 10);
    else if (etiqueta.startsWith('numero') && valor != null && String(valor).trim()) datos.numero = String(valor).trim();
    else if (etiqueta.startsWith('notas') && valor != null && String(valor).trim()) datos.notas = String(valor).trim();
  }
  if (!datos.vigencia) errores.push({ fila: 0, mensaje: 'Falta la fecha "Vigente desde".' });
  if (!datos.numero) errores.push({ fila: 0, mensaje: 'Falta el "Número de lista".' });

  const productos: Componente[] = [];
  const vistos = new Map<number, number>();
  for (let r = filaEnc + 1; r <= ws.rowCount; r++) {
    const celda = (nombre: string) => { const i = col.get(norm(nombre)); return i ? valorCelda(ws.getCell(r, i).value) : null; };
    const vacia = COLUMNAS_PRECIOS.slice(0, 9).every((c) => { const v = celda(c); return v == null || String(v).trim() === ''; });
    if (vacia) continue;
    const err = (columna: string, mensaje: string) => errores.push({ fila: r, columna, mensaje });

    const codigo = numero(celda('Código'));
    if (!Number.isInteger(codigo) || codigo < 1_000_000 || codigo > 9_999_999) { err('Código', 'El código debe tener 7 dígitos.'); continue; }
    if (vistos.has(codigo)) { err('Código', `Código ${codigo} repetido (también en la fila ${vistos.get(codigo)}).`); continue; }
    vistos.set(codigo, r);

    const t = norm(celda('Tipo'));
    const tipo = ({ b: 'B', base: 'B', c: 'C', colorante: 'C', a: 'A', accesorio: 'A' } as Record<string, TipoComponente>)[t];
    if (!tipo) err('Tipo', 'Tipo inválido: usá B, C o A.');
    const u = norm(celda('Unidad'));
    const unidad = ({ litros: 'L', l: 'L', kilos: 'K', k: 'K' } as Record<string, Unidad>)[u];
    if (!unidad) err('Unidad', 'Unidad inválida: usá Litros o Kilos.');
    const nombre = String(celda('Nombre') ?? '').trim().replace(/\s+/g, ' ');
    if (!nombre) err('Nombre', 'Falta el nombre.');
    const pe = numero(celda('Peso Esp.'));
    if (!(pe > 0)) err('Peso Esp.', 'El peso específico debe ser mayor que cero.');

    const p1 = numero(celda('Precio 1')), c1 = numero(celda('Capa. 1'));
    const p2 = numero(celda('Precio 2'), 0), c2 = numero(celda('Capa. 2'), 0);
    if (!(p1 > 0)) err('Precio 1', 'Falta el precio del envase chico.');
    if (!(c1 > 0)) err('Capa. 1', 'Falta la capacidad del envase chico.');
    if (Number.isNaN(p2) || Number.isNaN(c2)) err('Precio 2', 'Precio 2 y Capa. 2 tienen que ser números.');
    else if (c2 > 0 && !(p2 > 0)) err('Precio 2', 'Falta el precio del envase grande (o poné Capa. 2 en cero si no existe).');
    else if (p2 > 0 && !(c2 > 0)) err('Capa. 2', 'Falta la capacidad del envase grande.');
    const bonif = numero(celda('Bonif.'), 0), rent = numero(celda('Rentab.'), 0);
    if (Number.isNaN(bonif) || bonif < 0 || bonif >= 100) err('Bonif.', 'La bonificación es un porcentaje entre 0 y 99.');
    if (Number.isNaN(rent) || rent < 0) err('Rentab.', 'La rentabilidad es un porcentaje mayor o igual a cero.');

    if (!tipo || !unidad || !nombre || !(pe > 0) || !(p1 > 0) || !(c1 > 0)) continue;
    productos.push({
      codigo, nombre, tipo, unidad, pesoEspecifico: pe,
      envases: [{ capacidad: c1, precio: p1 }, ...(p2 > 0 && c2 > 0 ? [{ capacidad: c2, precio: p2 }] : [])],
      ...(bonif > 0 ? { bonificacion: bonif / 100 } : {}),
      ...(rent > 0 ? { rentabilidad: rent / 100 } : {}),
    });
  }
  return { ...datos, productos, errores };
}

export interface CambioPrecio {
  codigo: number;
  nombre: string;
  antes: number[];
  despues: number[];
  /** Variación del precio del envase chico, en % (null si no había precio). */
  variacion: number | null;
}

export interface ResultadoAplicacion {
  componentes: Componente[];
  actualizados: CambioPrecio[];
  nuevos: Componente[];
  sinCambios: number;
  /** Productos del catálogo actual que no están en la planilla (se conservan). */
  noIncluidos: Componente[];
}

/**
 * Aplica una lista de precios al catálogo actual. Los productos de la planilla reemplazan a los
 * actuales (nombre, tipo, peso específico, envases y precios); los que no están se conservan.
 * La rentabilidad propia del distribuidor no viene en la lista oficial y no se toca aquí.
 */
export function aplicarListaPrecios(actuales: Componente[], lista: ListaPrecios): ResultadoAplicacion {
  const porCodigo = new Map(actuales.map((c) => [c.codigo, c]));
  const enLista = new Set(lista.productos.map((p) => p.codigo));
  const actualizados: CambioPrecio[] = [], nuevos: Componente[] = [];
  let sinCambios = 0;
  const componentes: Componente[] = [];
  for (const p of lista.productos) {
    const prev = porCodigo.get(p.codigo);
    const nuevo: Componente = { ...p, ...(prev?.fraccionBase !== undefined ? { fraccionBase: prev.fraccionBase } : {}) };
    componentes.push(nuevo);
    if (!prev) { nuevos.push(nuevo); continue; }
    const antes = prev.envases.map((e) => e.precio), despues = p.envases.map((e) => e.precio);
    if (antes.join('|') === despues.join('|')) { sinCambios++; continue; }
    const a0 = antes[0] ?? 0, d0 = despues[0] ?? 0;
    actualizados.push({ codigo: p.codigo, nombre: p.nombre, antes, despues, variacion: a0 > 0 ? Math.round((d0 / a0 - 1) * 1000) / 10 : null });
  }
  const noIncluidos = actuales.filter((c) => !enLista.has(c.codigo));
  componentes.push(...noIncluidos);
  componentes.sort((a, b) => a.codigo - b.codigo);
  return { componentes, actualizados, nuevos, sinCambios, noIncluidos };
}

/**
 * Quita los comentarios de celda antes de leer. No se usan y, según con qué programa se guardó
 * la planilla, la librería de lectura falla al ubicarlos.
 */
async function sinComentarios(contenido: Uint8Array | ArrayBuffer): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(contenido);
  for (const ruta of Object.keys(zip.files)) {
    if (/^xl\/worksheets\/_rels\/.+\.rels$/.test(ruta)) {
      const xml = await zip.file(ruta)!.async('string');
      zip.file(ruta, xml.replace(/<Relationship\b[^>]*Type="[^"]*\/(comments|vmlDrawing)"[^>]*\/>/g, ''));
    } else if (/^xl\/worksheets\/[^/]+\.xml$/.test(ruta)) {
      const xml = await zip.file(ruta)!.async('string');
      zip.file(ruta, xml.replace(/<legacyDrawing\b[^>]*\/>/g, ''));
    }
  }
  return zip.generateAsync({ type: 'arraybuffer' });
}

function valorCelda(v: ExcelJS.CellValue): string | number | Date | null {
  if (v == null) return null;
  if (typeof v === 'number' || typeof v === 'string' || v instanceof Date) return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') {
    if ('result' in v) return valorCelda(v.result as ExcelJS.CellValue); // fórmula
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return String(v.text);
  }
  return null;
}

/** Número desde una celda: acepta 20.4, "20,40" y "1.234,50". Vacío → valor por defecto (NaN). */
function numero(v: unknown, vacio = Number.NaN): number {
  if (v == null || v === '') return vacio;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!s) return vacio;
  const limpio = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : Number.NaN;
}
