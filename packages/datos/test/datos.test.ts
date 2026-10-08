import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { calcularPrecio, crearCatalogo, dosificarEnCapacidad, validarFormula } from '@albamix/core';
import { BaseJet1, BaseLocal, ErrorJet1, importarOriginales, leerComponentes, leerFormulas } from '../src/index.js';

const fx = (n: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url))));
const precios = fx('precios.mdb'), personal = fx('personal.mdb'), bonifica = fx('bonifica.mdb');

describe('lector Jet 1.x (cabecera dañada)', () => {
  it('descubre solas las tablas y columnas del catálogo', () => {
    const db = new BaseJet1(personal);
    expect([...db.tablas().keys()].sort()).toEqual(['FormulasC', 'FormulasCap', 'FormulasR', 'clave']);
    expect(db.tablas().get('FormulasC')!.columnas.map((c) => c.nombre)).toEqual(['ID', 'CODIGO', 'NOMBRE', 'OBS', 'FECHA']);
  });

  it('lee filas con tipos correctos (texto, entero, doble, fecha)', () => {
    const [f] = new BaseJet1(personal).leerTabla('FormulasC');
    expect(f).toMatchObject({ ID: 1, CODIGO: 3611, NOMBRE: 'Rojo Giorgi', OBS: '' });
    expect((f!.FECHA as Date).toISOString().slice(0, 10)).toBe('2011-07-15');
  });

  it('lee precios.mdb: 54 productos con columnas fijas y variables mezcladas', () => {
    const filas = new BaseJet1(precios).leerTabla('componentes');
    expect(filas).toHaveLength(54);
    expect(filas.find((x) => x.COMP === 4510000)).toMatchObject({
      NOMBRE: 'Esm. Sintetico Industrial Transparente', TIPO: 'B', UNIDAD: 'L', PE: 0.91, CAPA1: 3.2, CAPA2: 16,
    });
  });

  it('rechaza archivos que no son una base Access 1.x', () => {
    expect(() => new BaseJet1(new Uint8Array(1000))).toThrow(ErrorJet1);
    expect(() => new BaseJet1(personal).leerTabla('NoExiste')).toThrow(/no tiene la tabla/);
  });
});

describe('importación al modelo del núcleo', () => {
  it('productos: tipo, unidad, peso específico y solo los envases que existen', () => {
    const comps = leerComponentes(precios, bonifica);
    const base = comps.find((c) => c.codigo === 4510000)!;
    expect(base).toMatchObject({ tipo: 'B', unidad: 'L', pesoEspecifico: 0.91 });
    expect(base.envases.map((e) => e.capacidad)).toEqual([3.2, 16]);
    expect(comps.find((c) => c.codigo === 4600000)!.envases).toHaveLength(1);
    expect(comps.find((c) => c.codigo === 4597006)!.unidad).toBe('K');
  });

  it('fórmulas personales: renglones ordenados, capacidades propias y sistema detectado', () => {
    const [rojo] = leerFormulas(personal, 'personal');
    expect(rojo).toMatchObject({ codigo: 3611, nombre: 'Rojo Giorgi', origen: 'personal', sistema: 'GVA', fecha: '2011-07-15' });
    expect(rojo!.renglones.map((r) => r.linea)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rojo!.capacidades).toEqual([{ capacidad: 3.41, unidad: 'L' }, { capacidad: 17.05, unidad: 'L' }]);
  });

  it('la fórmula personal importada es válida y se puede dosificar', () => {
    const imp = importarOriginales({ precios, personal, bonifica });
    const cat = crearCatalogo(imp.componentes);
    const rojo = imp.formulas[0]!;
    expect(validarFormula(rojo, cat).ok).toBe(true);
    const d = dosificarEnCapacidad(rojo, cat, rojo.capacidades![0]!.capacidad);
    expect(d.totalMl).toBeCloseTo(3410, 6);
    expect(calcularPrecio(d, { rentabilidadGlobal: 0 }).costo).toBeGreaterThan(0);
  });

  it('el reporte cuenta lo importado y no encuentra componentes faltantes', () => {
    const { reporte } = importarOriginales({ precios, personal });
    expect(reporte).toMatchObject({ componentes: 54, formulasAlbamix: 0, formulasPersonales: 2, renglones: 8 });
    expect(reporte.componentesFaltantes).toEqual([]);
  });
});

describe('base local SQLite', () => {
  const imp = importarOriginales({ precios, personal, bonifica });
  const base = new BaseLocal();
  base.cargar(imp, { fuente: 'test' });

  it('ida y vuelta: lo que se guarda es lo que se lee', () => {
    expect(base.componentes()).toEqual([...imp.componentes].sort((a, b) => a.codigo - b.codigo));
    const id = base.buscar({ texto: 'giorgi' }).filas[0]!.id;
    const { id: _a, ...leida } = base.formula(id)!;
    const { id: _b, ...original } = imp.formulas[0]!;
    expect(leida).toEqual(original);
  });

  it('guarda metadatos del paquete y el reporte', () => {
    const m = base.meta();
    expect(m.version_esquema).toBe('1');
    expect(m.fuente).toBe('test');
    expect(JSON.parse(m.reporte!).formulasPersonales).toBe(2);
  });

  it('búsqueda: por código, por nombre, por rango y con orden', () => {
    expect(base.buscar({ texto: '3611' }).filas.map((f) => f.nombre)).toEqual(['Rojo Giorgi']);
    expect(base.buscar({ texto: 'PRUEBA' }).total).toBe(1);
    expect(base.buscar({ codigoDesde: 3000, codigoHasta: 4000 }).filas.map((f) => f.codigo)).toEqual([3611]);
    expect(base.buscar({ orden: 'codigo', descendente: true }).filas.map((f) => f.codigo)).toEqual([100000, 3611]);
    expect(base.buscar({ fechaDesde: '2011-07-15', fechaHasta: '2011-07-15' }).total).toBe(2);
    expect(base.buscar({ fechaDesde: '2012-01-01' }).total).toBe(0);
    expect(base.buscar({ texto: 'giorgi' }).filas[0]!.baseNombre).toBe('Esm. Sintetico Industrial Transparente');
  });

  it('una carga nueva reemplaza la anterior (paquete de actualización)', () => {
    base.cargar(importarOriginales({ precios }), { fuente: 'solo precios' });
    expect(base.buscar().total).toBe(0);
    expect(base.componentes()).toHaveLength(54);
  });
});

// Importación completa contra el albamix.mdb real (6.439 fórmulas). El archivo no se versiona:
// se corre si ALBAMIX_MDB apunta a él.
const rutaAlbamix = process.env.ALBAMIX_MDB;
describe.runIf(rutaAlbamix && existsSync(rutaAlbamix))('importación completa de albamix.mdb', () => {
  it('importa todas las fórmulas oficiales, sin componentes faltantes y todas válidas', () => {
    const imp = importarOriginales({ precios, albamix: new Uint8Array(readFileSync(rutaAlbamix!)), personal, bonifica });
    const r = imp.reporte;
    expect(r.formulasAlbamix).toBe(6436);
    expect(r.descartadasSinRenglones).toHaveLength(3);
    expect(r.renglones).toBe(31251 + 8);
    expect(r.componentesFaltantes).toEqual([]);
    expect(r.problemasValidacion).toEqual({});
    const base = new BaseLocal();
    base.cargar(imp);
    expect(base.buscar({ texto: '1552' }).total).toBe(9);
    expect(base.buscar({ codigoDesde: 1000, codigoHasta: 1003 }).total).toBeGreaterThan(10);
  });
});
