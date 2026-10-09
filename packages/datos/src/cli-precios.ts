/**
 * Lee la planilla de precios y muestra qué cambiaría; con --aplicar, actualiza la base local.
 *
 *   npm run precios -w @albamix/datos -- --excel lista-precios.xlsx --base albamix-datos.sqlite [--aplicar] [--forzar]
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { aplicarListaPrecios, leerListaPrecios } from './excel.js';
import { abrirBaseNode } from './node.js';

const { values } = parseArgs({ options: {
  excel: { type: 'string' }, base: { type: 'string' }, aplicar: { type: 'boolean', default: false }, forzar: { type: 'boolean', default: false },
} });
if (!values.excel || !values.base) { console.error('Uso: --excel lista.xlsx --base albamix-datos.sqlite [--aplicar]'); process.exit(1); }

const lista = await leerListaPrecios(new Uint8Array(readFileSync(values.excel)));
const nf = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
console.log(`Lista ${lista.numero ?? '(sin número)'}, vigente desde ${lista.vigencia ?? '(sin fecha)'}: ${lista.productos.length} productos válidos.`);
if (lista.errores.length) {
  console.log(`\n${lista.errores.length} problema(s) en la planilla:`);
  for (const e of lista.errores) console.log(`  ${e.fila ? `Fila ${e.fila}` : 'Lista'}${e.columna ? `, ${e.columna}` : ''}: ${e.mensaje}`);
}
const base = abrirBaseNode(values.base);
const r = aplicarListaPrecios(base.componentes(), lista);
console.log(`\nCambios de precio: ${r.actualizados.length} · Productos nuevos: ${r.nuevos.length} · Sin cambios: ${r.sinCambios} · No incluidos (se conservan): ${r.noIncluidos.length}`);
for (const c of r.actualizados.slice(0, 15)) {
  console.log(`  ${c.codigo} ${c.nombre}: $ ${c.antes.map(nf).join(' / ')} → $ ${c.despues.map(nf).join(' / ')}${c.variacion != null ? ` (${c.variacion > 0 ? '+' : ''}${c.variacion} %)` : ''}`);
}
if (r.actualizados.length > 15) console.log(`  … y ${r.actualizados.length - 15} más`);

if (!values.aplicar) { console.log('\nNo se aplicó nada. Agregá --aplicar para actualizar la base.'); process.exit(0); }
if (lista.errores.length) { console.error('\nNo se aplica: corregí primero los problemas de la planilla.'); process.exit(2); }
base.actualizarPrecios(r.componentes, { numero: lista.numero!, vigencia: lista.vigencia!, ...(lista.notas ? { notas: lista.notas } : {}) }, values.forzar);
base.cerrar();
console.log('\nLista aplicada.');
