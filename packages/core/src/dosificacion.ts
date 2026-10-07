import type { Catalogo, Componente, Formula } from './tipos.js';
import { TOTAL_CC, redondear } from './validacion.js';

export interface RenglonDosificado {
  linea: number;
  componente: Componente;
  /** c.c. por cada 1000 c.c. (dato de la fórmula). */
  cant: number;
  /** Volumen a agregar, en ml. */
  ml: number;
  /** Peso a agregar, en gramos (ml × peso específico). Es lo que se pesa en la balanza. */
  gramos: number;
}

export interface Dosificacion {
  formula: Formula;
  /** Índice del envase de base usado (0 = chico, 1 = grande). */
  envaseBase: number;
  /** Capacidad final de pintura terminada, en litros. */
  capacidad: number;
  renglones: RenglonDosificado[];
  totalMl: number;
  totalGramos: number;
}

export class ErrorDosificacion extends Error {}

/**
 * Dosifica una fórmula sobre un envase de base completo.
 *
 * Regla deducida de las listas de precios reales de Albamix: se tinta la lata de base entera,
 * y la pintura terminada rinde `capacidad del envase / (cant. de base / 1000)`.
 * Ej.: base de 3,2 L al 850 ‰ → 3,2 / 0,85 = 3,765 L.
 */
export function dosificarEnEnvase(formula: Formula, catalogo: Catalogo, envaseBase: number): Dosificacion {
  const renglones = [...formula.renglones].sort((a, b) => a.linea - b.linea);
  const primero = renglones[0];
  if (!primero) throw new ErrorDosificacion('La fórmula no tiene componentes.');
  const base = catalogo.get(primero.comp);
  if (!base || base.tipo !== 'B') throw new ErrorDosificacion('El primer componente de la fórmula no es una base.');
  const envase = base.envases[envaseBase];
  if (!envase || envase.capacidad <= 0) throw new ErrorDosificacion(`La base ${base.codigo} no tiene envase ${envaseBase + 1}.`);

  const capacidad = envase.capacidad / (primero.cant / TOTAL_CC);
  return armar(formula, catalogo, renglones, capacidad, envaseBase);
}

/** Dosifica una fórmula para una capacidad libre en litros (p. ej. fórmulas personales con capacidades propias). */
export function dosificarEnCapacidad(formula: Formula, catalogo: Catalogo, capacidadLitros: number): Dosificacion {
  if (!(capacidadLitros > 0)) throw new ErrorDosificacion('Capacidad inválida.');
  const renglones = [...formula.renglones].sort((a, b) => a.linea - b.linea);
  return armar(formula, catalogo, renglones, capacidadLitros, -1);
}

function armar(formula: Formula, catalogo: Catalogo, renglones: Formula['renglones'], capacidad: number, envaseBase: number): Dosificacion {
  const out: RenglonDosificado[] = renglones.map((r) => {
    const componente = catalogo.get(r.comp);
    if (!componente) throw new ErrorDosificacion(`No se encontró el componente: ${r.comp}`);
    const ml = (r.cant / TOTAL_CC) * capacidad * 1000;
    return { linea: r.linea, componente, cant: r.cant, ml, gramos: ml * componente.pesoEspecifico };
  });
  return {
    formula,
    envaseBase,
    capacidad,
    renglones: out,
    totalMl: out.reduce((s, r) => s + r.ml, 0),
    totalGramos: out.reduce((s, r) => s + r.gramos, 0),
  };
}

/** Capacidad redondeada a 3 decimales, como la muestran las listas de Albamix (3,765 / 18,824). */
export function capacidadMostrada(d: Dosificacion): number {
  return redondear(d.capacidad, 3);
}
