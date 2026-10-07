// Demo por consola: dosifica RAL 1012 (caso de oro) en los dos envases y muestra gramos y precio.
import golden from '../test/fixtures/golden-concentrados.json' with { type: 'json' };
import { calcularPrecio, capacidadMostrada, crearCatalogo, dosificarEnEnvase, type Componente, type Formula } from '../src/index.js';

const catalogo = crearCatalogo(golden.componentes as Componente[]);
const caso = golden.casos[0]!;
const formula: Formula = { codigo: caso.codigo, nombre: caso.nombre, renglones: caso.renglones };
const fmt = (n: number, d = 2) => n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

for (const envase of [0, 1]) {
  const d = dosificarEnEnvase(formula, catalogo, envase);
  const p = calcularPrecio(d, { rentabilidadGlobal: 0.31842 });
  console.log(`\n${formula.nombre} — envase ${envase === 0 ? 'chico' : 'grande'} — rinde ${fmt(capacidadMostrada(d), 3)} L`);
  console.table(d.renglones.map((r) => ({
    Código: r.componente.codigo, Componente: r.componente.nombre, 'c.c./1000': r.cant, ml: fmt(r.ml, 1), gramos: fmt(r.gramos, 1),
  })));
  console.log(`Costo $${fmt(p.costo)}  →  Precio sin IVA $${fmt(p.precio)}`);
}
