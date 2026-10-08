import { describe, expect, it } from 'vitest';
import golden from './fixtures/golden-concentrados.json';
import gva from './fixtures/gva-muestra.json';
import {
  avisarCantidadesChicas, corregirExceso, crearCatalogo, dosificarEnEnvase,
  type Componente, type Formula,
} from '../src/index.js';

const catGva = crearCatalogo(gva.componentes as Componente[]);
const f5301 = (gva.formulas as Formula[])[0]!;
const catConc = crearCatalogo(golden.componentes as Componente[]);
const caso = golden.casos[0]!;
const ral1012: Formula = { codigo: caso.codigo, nombre: caso.nombre, renglones: caso.renglones };

describe('aviso de cantidades muy chicas', () => {
  it('fórmula 5301 en lata de 3,2 L: avisa los 1,7 g de azul y sugiere la lata de 16 L', () => {
    const d = dosificarEnEnvase(f5301, catGva, 0);
    const r = avisarCantidadesChicas(d);
    expect(r.avisos.map((a) => a.codigo)).toEqual([4600004]);
    expect(r.avisos[0]!.gramos).toBeCloseTo(1.744, 3);
    expect(r.capacidadMinima!).toBeGreaterThan(d.capacidad);
    expect(r.envaseSugerido).toBe(1);
  });

  it('en la lata de 16 L ya no hay avisos', () => {
    expect(avisarCantidadesChicas(dosificarEnEnvase(f5301, catGva, 1)).avisos).toEqual([]);
  });

  it('el umbral es configurable', () => {
    const d = dosificarEnEnvase(f5301, catGva, 1);
    expect(avisarCantidadesChicas(d, 10).avisos.map((a) => a.codigo)).toEqual([4600004]);
  });
});

describe('"me pasé" en la balanza', () => {
  const d = dosificarEnEnvase(ral1012, catConc, 0);
  // Paso 2 (índice 1): Concentrado Azul pedía 31,8 ml ≈ 33,65 g; el operador puso 40 g.
  const pedido = d.renglones[1]!.gramos;
  const c = corregirExceso(d, 1, 40);

  it('agranda toda la tanda en la misma proporción', () => {
    expect(c.factor).toBeCloseTo(40 / pedido, 10);
    expect(c.capacidadNueva).toBeCloseTo(d.capacidad * c.factor, 10);
  });

  it('de la base ya vertida pide solo la diferencia, y avisa que hace falta otra lata', () => {
    const base = c.renglones[0]!;
    expect(base.agregar).toBeCloseTo(3840 * (c.factor - 1), 6);
    expect(c.requiereMasBase).toBe(true);
  });

  it('el componente en que se pasó no se toca, y los que faltan se escalan completos', () => {
    expect(c.renglones[1]!.agregar).toBe(0);
    expect(c.renglones[1]!.gramosNuevos).toBe(40);
    const verde = c.renglones[2]!;
    expect(verde.yaVertido).toBe(false);
    expect(verde.agregar).toBeCloseTo(verde.gramosOriginales * c.factor, 10);
  });

  it('conserva las proporciones: cada componente sigue siendo la misma fracción del total', () => {
    const totalNuevo = c.renglones.at(-1)!.acumulado;
    const totalOrig = d.totalGramos;
    c.renglones.forEach((r) => expect(r.gramosNuevos / totalNuevo).toBeCloseTo(r.gramosOriginales / totalOrig, 10));
  });

  it('si no se pasó (puso lo justo o menos), no cambia nada', () => {
    const justo = corregirExceso(d, 1, pedido);
    expect(justo.factor).toBe(1);
    expect(justo.requiereMasBase).toBe(false);
    expect(justo.renglones.slice(2).every((r) => r.agregar === r.gramosOriginales)).toBe(true);
  });

  it('rechaza pasos o pesos inválidos', () => {
    expect(() => corregirExceso(d, 9, 10)).toThrow(/paso 10/);
    expect(() => corregirExceso(d, 1, 0)).toThrow(/mayores que cero/);
  });
});
