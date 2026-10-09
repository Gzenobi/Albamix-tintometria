import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { aplicarListaPrecios, BaseLocal, importarOriginales, leerListaPrecios } from '../src/index.js';

const fx = (n: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url))));
const ENC = ['Tipo', 'Código', 'Nombre', 'Peso Esp.', 'Precio 1', 'Capa. 1', 'Precio 2', 'Capa. 2', 'Unidad', 'Bonif.', 'Rentab.', '$ por litro 1', '$ por litro 2'];

/** Arma una planilla con el mismo diseño que genera herramientas/plantilla_precios.py. */
async function planilla(filas: unknown[][], meta: { vigencia?: Date; numero?: string; notas?: string } = { vigencia: new Date(Date.UTC(2026, 9, 1)), numero: '2026-10' }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Precios');
  ws.getCell('A1').value = 'Lista de precios Albamix';
  ws.getCell('A2').value = 'Vigente desde:'; ws.getCell('B2').value = meta.vigencia ?? null;
  ws.getCell('A3').value = 'Número de lista:'; ws.getCell('B3').value = meta.numero ?? null;
  ws.getCell('A4').value = 'Notas:'; ws.getCell('B4').value = meta.notas ?? null;
  ws.getRow(7).values = ENC;
  filas.forEach((f, i) => {
    const r = 8 + i;
    ws.getRow(r).values = f as ExcelJS.CellValue[];
    ws.getCell(r, 12).value = { formula: `IFERROR(E${r}/F${r},"")`, result: 0 };
  });
  wb.addWorksheet('Instrucciones').getCell('A1').value = 'Cómo usar esta planilla';
  return new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer);
}

const BASE = ['B', 4510000, 'Esm. Sintetico Industrial Transparente', 0.91, 20.4, 3.2, 93.47, 16, 'Litros', 0, 0];
const COLORANTE = ['C', 4600000, 'GVA147 BLANCO', 1.68, 41.16, 1, 0, 0, 'Litros', 0, 0];

describe('lectura de la planilla de precios', () => {
  it('lee la lista: vigencia, número, notas y productos con sus envases', async () => {
    const l = await leerListaPrecios(await planilla([BASE, COLORANTE], { vigencia: new Date(Date.UTC(2026, 9, 1)), numero: '2026-10', notas: 'Aumento 4 %' }));
    expect(l.errores).toEqual([]);
    expect(l).toMatchObject({ vigencia: '2026-10-01', numero: '2026-10', notas: 'Aumento 4 %' });
    expect(l.productos[0]).toEqual({
      codigo: 4510000, nombre: 'Esm. Sintetico Industrial Transparente', tipo: 'B', unidad: 'L', pesoEspecifico: 0.91,
      envases: [{ capacidad: 3.2, precio: 20.4 }, { capacidad: 16, precio: 93.47 }],
    });
    expect(l.productos[1]!.envases).toEqual([{ capacidad: 1, precio: 41.16 }]);
  });

  it('acepta números escritos con coma decimal y tipos/unidades en palabras', async () => {
    const l = await leerListaPrecios(await planilla([['Base', '4510000', 'Esm.  Sintetico', '0,91', '1.234,50', '3,2', '0', '0', 'kilos', '', '']]));
    expect(l.errores).toEqual([]);
    expect(l.productos[0]).toMatchObject({ tipo: 'B', unidad: 'K', nombre: 'Esm. Sintetico', pesoEspecifico: 0.91, envases: [{ capacidad: 3.2, precio: 1234.5 }] });
  });

  it('informa cada problema con su fila y columna, y no incluye esos productos', async () => {
    const l = await leerListaPrecios(await planilla([
      BASE,
      ['C', 4600001, 'Sin precio', 1.58, null, 1, 0, 0, 'Litros'],
      ['X', 4600002, 'Tipo malo', 1.7, 10, 1, 0, 0, 'Litros'],
      ['B', 4510000, 'Repetido', 0.9, 20, 3.2, 90, 16, 'Litros'],
      ['B', 4519000, 'Envase grande incompleto', 0.88, 17.5, 3.2, 0, 16, 'Litros'],
      ['C', 123, 'Código corto', 1, 1, 1, 0, 0, 'Litros'],
    ]));
    expect(l.productos.map((p) => p.codigo)).toEqual([4510000, 4519000]);
    expect(l.errores.map((e) => `${e.fila}:${e.columna}`)).toEqual(['9:Precio 1', '10:Tipo', '11:Código', '12:Precio 2', '13:Código']);
  });

  it('exige vigencia y número de lista', async () => {
    const l = await leerListaPrecios(await planilla([BASE], {}));
    expect(l.errores.map((e) => e.mensaje)).toEqual(['Falta la fecha "Vigente desde".', 'Falta el "Número de lista".']);
  });

  it('avisa si no encuentra los encabezados', async () => {
    const wb = new ExcelJS.Workbook(); wb.addWorksheet('Precios').getCell('A1').value = 'otra cosa';
    const l = await leerListaPrecios(new Uint8Array(await wb.xlsx.writeBuffer() as ArrayBuffer));
    expect(l.errores[0]!.mensaje).toMatch(/encabezados/);
  });
});

describe('aplicación de la lista al catálogo', () => {
  const actuales = importarOriginales({ precios: fx('precios.mdb') }).componentes; // precios en $0,10

  it('resume cambios, nuevos, sin cambios y no incluidos', async () => {
    const lista = await leerListaPrecios(await planilla([BASE, ['A', 4597999, 'Producto nuevo', 1, 50, 1, 0, 0, 'Kilos']]));
    const r = aplicarListaPrecios(actuales, lista);
    expect(r.actualizados).toEqual([{ codigo: 4510000, nombre: 'Esm. Sintetico Industrial Transparente', antes: [0.1, 0.1], despues: [20.4, 93.47], variacion: 20300 }]);
    expect(r.nuevos.map((c) => c.codigo)).toEqual([4597999]);
    expect(r.noIncluidos).toHaveLength(actuales.length - 1);
    expect(r.componentes).toHaveLength(actuales.length + 1);
  });

  it('en la base local actualiza precios sin tocar las fórmulas y rechaza listas viejas', async () => {
    const base = new BaseLocal();
    base.cargar(importarOriginales({ precios: fx('precios.mdb'), personal: fx('personal.mdb') }));
    const formulasAntes = base.buscar().total;
    const lista = await leerListaPrecios(await planilla([BASE]));
    base.actualizarPrecios(aplicarListaPrecios(base.componentes(), lista).componentes, { numero: '2026-10', vigencia: '2026-10-01' });
    expect(base.componentes().find((c) => c.codigo === 4510000)!.envases[1]!.precio).toBe(93.47);
    expect(base.buscar().total).toBe(formulasAntes);
    expect(base.meta().lista_precios_numero).toBe('2026-10');
    expect(() => base.actualizarPrecios(base.componentes(), { numero: '2026-09', vigencia: '2026-09-01' })).toThrow(/no es posterior/);
    expect(() => base.actualizarPrecios(base.componentes(), { numero: '2026-11', vigencia: '2026-11-01' })).not.toThrow();
  });
});

describe('compatibilidad', () => {
  it('lee planillas con comentarios de celda re-guardadas por otro programa', async () => {
    const l = await leerListaPrecios(fx('lista-con-comentarios.xlsx'));
    expect(l.errores).toEqual([]);
    expect(l).toMatchObject({ numero: '2026-11', vigencia: '2026-11-01' });
    expect(l.productos[0]!.envases).toEqual([{ capacidad: 3.2, precio: 21.5 }, { capacidad: 16, precio: 98.1 }]);
  });

  it('un archivo que no es Excel devuelve un error claro', async () => {
    const l = await leerListaPrecios(new TextEncoder().encode('no soy un excel'));
    expect(l.errores[0]!.mensaje).toMatch(/no es una planilla Excel/);
  });
});
