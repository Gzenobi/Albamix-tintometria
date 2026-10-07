import { describe, expect, it } from 'vitest';
import gva from './fixtures/gva-muestra.json';
import { crearCatalogo, dosificarEnCapacidad, dosificarEnEnvase, capacidadMostrada, type Componente, type Formula } from '../src/index.js';

const catalogo = crearCatalogo(gva.componentes as Componente[]);
const [f5301, f12341] = gva.formulas as Formula[];

describe('dosificación', () => {
  it('fórmula 5301 en 4 L: ml = cant × capacidad y gramos = ml × peso específico', () => {
    const d = dosificarEnCapacidad(f5301!, catalogo, 4);
    const fila = (comp: number) => d.renglones.find((r) => r.componente.codigo === comp)!;
    expect(fila(4514130).ml).toBeCloseTo(3520, 6);
    expect(fila(4514130).gramos).toBeCloseTo(3168, 6);
    expect(fila(4600301).ml).toBeCloseTo(239.12, 6);
    expect(fila(4600301).gramos).toBeCloseTo(263.032, 6);
    expect(d.totalMl).toBeCloseTo(4000, 6);
  });

  it('sistema GVA: base de 3,2 L al 880 rinde 3,636 L; base amarilla de 3,7 L al 980 rinde 3,776 L', () => {
    expect(capacidadMostrada(dosificarEnEnvase(f5301!, catalogo, 0))).toBe(3.636);
    expect(capacidadMostrada(dosificarEnEnvase(f12341!, catalogo, 0))).toBe(3.776);
    expect(capacidadMostrada(dosificarEnEnvase(f12341!, catalogo, 1))).toBe(18.878);
  });

  it('el volumen de base dosificado es el envase completo', () => {
    const d = dosificarEnEnvase(f12341!, catalogo, 1);
    expect(d.renglones[0]!.ml).toBeCloseTo(18500, 6);
  });

  it('rechaza un envase que la base no tiene', () => {
    expect(() => dosificarEnEnvase(f5301!, catalogo, 2)).toThrow(/no tiene envase 3/);
  });
});
