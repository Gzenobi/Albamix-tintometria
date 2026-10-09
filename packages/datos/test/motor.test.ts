import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BaseLocal, importarOriginales, MotorSqlJs } from '../src/index.js';
import { abrirBaseNode } from '../src/node.js';

const fx = (n: string) => new Uint8Array(readFileSync(fileURLToPath(new URL(`./fixtures/${n}`, import.meta.url))));
const rutaAlbamix = process.env.ALBAMIX_MDB;
const albamix = rutaAlbamix && existsSync(rutaAlbamix) ? new Uint8Array(readFileSync(rutaAlbamix)) : undefined;

describe('motor web (sql.js) equivalente a node:sqlite', () => {
  const imp = importarOriginales({ precios: fx('precios.mdb'), personal: fx('personal.mdb'), bonifica: fx('bonifica.mdb'), ...(albamix ? { albamix } : {}) });

  it('mismos productos, búsquedas y fórmulas con los dos motores', async () => {
    const web = new BaseLocal(await MotorSqlJs.abrir());
    const node = abrirBaseNode();
    const t0 = performance.now();
    web.cargar(imp, { fuente: 'test' });
    const ms = performance.now() - t0;
    node.cargar(imp, { fuente: 'test' });
    expect(web.componentes()).toEqual(node.componentes());
    for (const filtro of [{}, { texto: 'giorgi' }, { texto: '1552' }, { codigoDesde: 1000, codigoHasta: 1100, orden: 'nombre' as const, descendente: true }]) {
      expect(web.buscar(filtro)).toEqual(node.buscar(filtro));
    }
    const id = web.buscar().filas[0]!.id;
    expect(web.formula(id)).toEqual(node.formula(id));
    expect(web.cantidadFormulas()).toBe(imp.formulas.length);
    if (albamix) expect(ms).toBeLessThan(10000); // carga completa (6.438 fórmulas) en la app
  });

  it('la base se exporta a bytes y se vuelve a abrir igual (así se guarda en disco)', async () => {
    const m = await MotorSqlJs.abrir();
    const a = new BaseLocal(m);
    a.cargar(imp, { fuente: 'test' });
    const b = new BaseLocal(await MotorSqlJs.abrir(m.exportar()));
    expect(b.buscar()).toEqual(a.buscar());
    expect(b.meta().fuente).toBe('test');
  });
});
