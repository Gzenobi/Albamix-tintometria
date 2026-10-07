import type { Catalogo, Formula } from './tipos.js';

/** Tolerancia para la suma de 1000 c.c. (las cantidades tienen 2 decimales). */
const TOLERANCIA_TOTAL = 0.005;
export const TOTAL_CC = 1000;

export type CodigoProblema =
  | 'CODIGO_INVALIDO'
  | 'NOMBRE_VACIO'
  | 'SIN_COMPONENTES'
  | 'COMPONENTE_INEXISTENTE'
  | 'COMPONENTE_REPETIDO'
  | 'CANTIDAD_INVALIDA'
  | 'BASE_NO_PRIMERA'
  | 'BASE_FUERA_DE_LINEA_1'
  | 'TOTAL_DISTINTO_DE_1000'
  | 'CANTIDAD_BASE_INCORRECTA'
  // Advertencias (el usuario puede confirmar y seguir):
  | 'CODIGO_NUEVO'
  | 'NOMBRE_NO_COINCIDE'
  | 'FORMULA_SIMILAR_EXISTE';

export interface Problema {
  codigo: CodigoProblema;
  mensaje: string;
  linea?: number;
}

export interface ResultadoValidacion {
  ok: boolean;
  errores: Problema[];
  advertencias: Problema[];
}

/** Datos de contexto para las advertencias (lo que ya existe en la base de fórmulas). */
export interface ContextoValidacion {
  /** Nombres ya usados para este código de color. Vacío = código nuevo. */
  nombresExistentes?: readonly string[];
  /** Ya existe otra fórmula con el mismo código y la misma base. */
  existeFormulaMismaBase?: boolean;
}

/**
 * Valida una fórmula con las reglas de Albamix (frmFormula.validarDatos del original).
 * Los errores bloquean el guardado; las advertencias se confirman.
 */
export function validarFormula(
  f: Formula,
  catalogo: Catalogo,
  ctx: ContextoValidacion = {},
): ResultadoValidacion {
  const errores: Problema[] = [];
  const advertencias: Problema[] = [];

  if (!Number.isInteger(f.codigo) || f.codigo <= 0) {
    errores.push({ codigo: 'CODIGO_INVALIDO', mensaje: 'Debe ingresar un código válido (número entero mayor que cero).' });
  }
  if (!f.nombre.trim()) {
    errores.push({ codigo: 'NOMBRE_VACIO', mensaje: 'Debe ingresar una descripción.' });
  }

  const renglones = [...f.renglones].sort((a, b) => a.linea - b.linea);
  if (renglones.length === 0) {
    errores.push({ codigo: 'SIN_COMPONENTES', mensaje: 'No ha ingresado componentes.' });
    return { ok: false, errores, advertencias };
  }

  const vistos = new Set<number>();
  let total = 0;
  renglones.forEach((r, i) => {
    const comp = catalogo.get(r.comp);
    if (!comp) {
      errores.push({ codigo: 'COMPONENTE_INEXISTENTE', linea: r.linea, mensaje: `No se encontró en la base de datos el componente de la fila ${r.linea} (${r.comp}).` });
    } else if (i === 0 && comp.tipo !== 'B') {
      errores.push({ codigo: 'BASE_NO_PRIMERA', linea: r.linea, mensaje: 'La base debe ser el primer componente.' });
    } else if (i > 0 && comp.tipo === 'B') {
      errores.push({ codigo: 'BASE_FUERA_DE_LINEA_1', linea: r.linea, mensaje: `La fila ${r.linea} es una base: solo puede haber una base y va primera.` });
    }
    if (vistos.has(r.comp)) {
      errores.push({ codigo: 'COMPONENTE_REPETIDO', linea: r.linea, mensaje: `Componente ${r.comp} repetido.` });
    }
    vistos.add(r.comp);
    if (!Number.isFinite(r.cant) || r.cant <= 0) {
      errores.push({ codigo: 'CANTIDAD_INVALIDA', linea: r.linea, mensaje: `Cantidad inválida en la línea ${r.linea}.` });
    } else {
      total += r.cant;
    }
  });

  if (Math.abs(total - TOTAL_CC) > TOLERANCIA_TOTAL) {
    errores.push({
      codigo: 'TOTAL_DISTINTO_DE_1000',
      mensaje: `Las cantidades de componentes deben totalizar 1000 c.c. Actualmente totalizan: ${redondear(total, 2)} c.c.`,
    });
  }

  const primero = renglones[0];
  const base = primero ? catalogo.get(primero.comp) : undefined;
  if (primero && base?.tipo === 'B' && base.fraccionBase !== undefined && Math.abs(primero.cant - base.fraccionBase) > TOLERANCIA_TOTAL) {
    errores.push({
      codigo: 'CANTIDAD_BASE_INCORRECTA',
      linea: primero.linea,
      mensaje: `Para esa base, la cantidad debe ser ${base.fraccionBase} c.c.`,
    });
  }

  if (ctx.nombresExistentes) {
    const nombre = normalizarNombre(f.nombre);
    if (ctx.nombresExistentes.length === 0) {
      advertencias.push({ codigo: 'CODIGO_NUEVO', mensaje: 'Está ingresando al sistema un código de color nuevo.' });
    } else if (!ctx.nombresExistentes.some((n) => normalizarNombre(n) === nombre)) {
      advertencias.push({
        codigo: 'NOMBRE_NO_COINCIDE',
        mensaje: `El nombre de color no se corresponde con el código. Nombres existentes: ${ctx.nombresExistentes.join(', ')}.`,
      });
    }
  }
  if (ctx.existeFormulaMismaBase) {
    advertencias.push({ codigo: 'FORMULA_SIMILAR_EXISTE', mensaje: 'Ya existe una fórmula para el mismo color y la misma base.' });
  }

  return { ok: errores.length === 0, errores, advertencias };
}

/** Compara nombres ignorando mayúsculas y espacios repetidos ("IRAM 05-1-020  AMARILLO" = "IRAM 05-1-020 AMARILLO"). */
export function normalizarNombre(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function redondear(n: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round((n + Number.EPSILON) * f) / f;
}
