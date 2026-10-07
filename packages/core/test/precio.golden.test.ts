import { describe, expect, it } from 'vitest';
import golden from './fixtures/golden-concentrados.json';
import { calcularPrecio, capacidadMostrada, crearCatalogo, dosificarEnEnvase, type Componente, type Formula } from '../src/index.js';

/**
 * Casos de oro: fórmulas del sistema Concentrados recuperadas del albamix.mdb original,
 * con los precios de PESO_ESP y los precios publicados en la lista EXPORT.CSV de la app vieja.
 */
const catalogo = crearCatalogo(golden.componentes as Componente[]);
const num = (s: string) => Number(s.replace(',', '.'));

describe.each(golden.casos)('$nombre (color $codigo)', (caso) => {
  const formula: Formula = { codigo: caso.codigo, nombre: caso.nombre, renglones: caso.renglones };
  const lista = Object.entries(caso.listaEXPORT).map(([cap, precio]) => ({ cap: num(cap), precio: num(precio) }))
    .sort((a, b) => a.cap - b.cap);
  const [chico, grande] = lista;

  it('las capacidades coinciden con la lista (envase de base / fracción de base)', () => {
    expect(capacidadMostrada(dosificarEnEnvase(formula, catalogo, 0))).toBe(chico!.cap);
    expect(capacidadMostrada(dosificarEnEnvase(formula, catalogo, 1))).toBe(grande!.cap);
  });

  it('con la rentabilidad deducida del envase chico, el envase grande da exacto el precio de lista', () => {
    const dChico = dosificarEnEnvase(formula, catalogo, 0);
    const costoChico = calcularPrecio(dChico, { rentabilidadGlobal: 0 }).costo;
    const rentabilidad = chico!.precio / costoChico - 1;

    const params = { rentabilidadGlobal: rentabilidad };
    expect(calcularPrecio(dChico, params).precio).toBe(chico!.precio);
    expect(calcularPrecio(dosificarEnEnvase(formula, catalogo, 1), params).precio).toBe(grande!.precio);
  });
});
