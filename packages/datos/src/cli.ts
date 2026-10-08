/**
 * Importa las .mdb del Albamix original a una base local SQLite (el "paquete de datos").
 *
 *   npm run importar -w @albamix/datos -- --precios precios.mdb --albamix albamix.mdb \
 *       [--personal personal.mdb] [--bonifica bonifica.mdb] --salida albamix-datos.sqlite
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { importarOriginales } from './importar.js';
import { BaseLocal } from './base.js';

const { values } = parseArgs({
  options: {
    precios: { type: 'string' }, albamix: { type: 'string' }, personal: { type: 'string' },
    bonifica: { type: 'string' }, salida: { type: 'string', default: 'albamix-datos.sqlite' },
  },
});
if (!values.precios) {
  console.error('Falta --precios (precios.mdb con el maestro de productos).');
  process.exit(1);
}
const leer = (p?: string) => (p ? new Uint8Array(readFileSync(p)) : undefined);
const imp = importarOriginales({
  precios: leer(values.precios)!, albamix: leer(values.albamix), personal: leer(values.personal), bonifica: leer(values.bonifica),
});
if (existsSync(values.salida!)) rmSync(values.salida!);
const base = new BaseLocal(values.salida);
base.cargar(imp, { fuente: 'Importación de .mdb del Albamix original' });
base.cerrar();

const r = imp.reporte;
console.log(`Base creada: ${values.salida}`);
console.log(`  Productos: ${r.componentes}`);
console.log(`  Fórmulas Albamix: ${r.formulasAlbamix}  ·  Personales: ${r.formulasPersonales}  ·  Renglones: ${r.renglones}`);
console.log(`  Descartadas sin renglones: ${r.descartadasSinRenglones.length}`);
console.log(`  Nombres corregidos (solo espacios): ${r.nombresNormalizados}`);
console.log(`  Duplicados código + base: ${r.duplicadosCodigoBase}`);
console.log(`  Problemas de validación: ${JSON.stringify(r.problemasValidacion)}`);
console.log(`  Componentes faltantes en el maestro: ${r.componentesFaltantes.join(', ') || 'ninguno'}`);
