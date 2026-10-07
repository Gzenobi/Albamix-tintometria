import { describe, expect, it } from 'vitest';
import gva from './fixtures/gva-muestra.json';
import { crearCatalogo, validarFormula, type Componente, type Formula } from '../src/index.js';

const catalogo = crearCatalogo(gva.componentes as Componente[]);
const valida = (gva.formulas as Formula[])[0]!;
const con = (cambios: Partial<Formula>): Formula => ({ ...valida, ...cambios });
const codigos = (f: Formula, ctx = {}) => {
  const r = validarFormula(f, catalogo, ctx);
  return { errores: r.errores.map((e) => e.codigo), advertencias: r.advertencias.map((e) => e.codigo) };
};

describe('validación de fórmulas (reglas del Albamix original)', () => {
  it('una fórmula real del albamix.mdb es válida', () => {
    expect(validarFormula(valida, catalogo).ok).toBe(true);
  });

  it('R1: los componentes deben sumar 1000 c.c.', () => {
    const r = valida.renglones.map((x, i) => (i === 1 ? { ...x, cant: x.cant - 0.01 } : x));
    expect(codigos(con({ renglones: r })).errores).toEqual(['TOTAL_DISTINTO_DE_1000']);
  });

  it('R2: la base debe ser el primer componente', () => {
    const r = valida.renglones.map((x) => ({ ...x, linea: x.linea === 1 ? 9 : x.linea }));
    expect(codigos(con({ renglones: r })).errores).toContain('BASE_NO_PRIMERA');
  });

  it('R3: componente repetido o inexistente', () => {
    const rep = [...valida.renglones.slice(0, 4), { linea: 5, comp: 4600000, cant: 59.78 }];
    expect(codigos(con({ renglones: rep })).errores).toEqual(['COMPONENTE_REPETIDO']);
    const inex = valida.renglones.map((x) => (x.linea === 5 ? { ...x, comp: 9999999 } : x));
    expect(codigos(con({ renglones: inex })).errores).toEqual(['COMPONENTE_INEXISTENTE']);
  });

  it('R4: código de color entero mayor que cero y nombre obligatorio', () => {
    expect(codigos(con({ codigo: 0 })).errores).toEqual(['CODIGO_INVALIDO']);
    expect(codigos(con({ codigo: 1.5 })).errores).toEqual(['CODIGO_INVALIDO']);
    expect(codigos(con({ nombre: '  ' })).errores).toEqual(['NOMBRE_VACIO']);
  });

  it('R6: si la base define su fracción, la cantidad de base debe coincidir', () => {
    const cat = crearCatalogo([...catalogo.values()].map((c) => (c.codigo === 4514130 ? { ...c, fraccionBase: 850 } : c)));
    expect(validarFormula(valida, cat).errores.map((e) => e.codigo)).toEqual(['CANTIDAD_BASE_INCORRECTA']);
  });

  it('advertencias: código nuevo, nombre distinto (ignorando espacios) y fórmula similar', () => {
    expect(codigos(valida, { nombresExistentes: [] }).advertencias).toEqual(['CODIGO_NUEVO']);
    expect(codigos(valida, { nombresExistentes: ['IRAM 05-1-020 AMARILLO'] }).advertencias).toEqual([]);
    expect(codigos(valida, { nombresExistentes: ['AMARILLO PETINARI'] }).advertencias).toEqual(['NOMBRE_NO_COINCIDE']);
    expect(codigos(valida, { existeFormulaMismaBase: true }).advertencias).toEqual(['FORMULA_SIMILAR_EXISTE']);
  });
});
