import type { Componente } from './tipos.js';
import type { Dosificacion } from './dosificacion.js';
import { redondear } from './validacion.js';

export interface ParametrosPrecio {
  /** Rentabilidad por defecto si la base no tiene una propia, como fracción. */
  rentabilidadGlobal: number;
}

export interface DetallePrecio {
  /** Costo de la base: el envase completo si se dosificó en envase, o proporcional si fue capacidad libre. */
  costoBase: number;
  costoColorantes: number;
  costo: number;
  rentabilidad: number;
  /** Precio final sin IVA, redondeado a centavos. */
  precio: number;
}

/** Precio por litro (o kilo) de un componente, según su envase chico. */
export function precioPorUnidad(c: Componente): number {
  const e = c.envases[0];
  if (!e || e.capacidad <= 0) return 0;
  return e.precio / e.capacidad;
}

/**
 * Precio de una dosificación — modelo verificado contra las listas de precios de Albamix:
 *
 *   costo  = precio del envase de base completo + Σ litros de colorante × precio por litro
 *   precio = costo × (1 + rentabilidad de la base)
 *
 * El factor (1 + rentabilidad) resultó idéntico para los dos envases de una misma fórmula y
 * distinto según la base (≈1,318 Caucho Clorado, ≈1,39 PU Acrílico, ≈1,30 Epoxi).
 * SUPUESTO pendiente de confirmar: que ese factor sea una rentabilidad por base (rentabil.mdb).
 * SUPUESTO: la bonificación es un descuento sobre el costo de cada componente (en los datos vale 0).
 */
export function calcularPrecio(d: Dosificacion, params: ParametrosPrecio): DetallePrecio {
  const [rBase, ...rResto] = d.renglones;
  if (!rBase) throw new Error('Dosificación vacía.');
  const base = rBase.componente;

  const envase = d.envaseBase >= 0 ? base.envases[d.envaseBase] : undefined;
  const costoBaseBruto = envase ? envase.precio : (rBase.ml / 1000) * precioPorUnidad(base);
  const costoBase = costoBaseBruto * (1 - (base.bonificacion ?? 0));

  const costoColorantes = rResto.reduce(
    (s, r) => s + (r.ml / 1000) * precioPorUnidad(r.componente) * (1 - (r.componente.bonificacion ?? 0)),
    0,
  );

  const costo = costoBase + costoColorantes;
  const rentabilidad = base.rentabilidad ?? params.rentabilidadGlobal;
  return { costoBase, costoColorantes, costo, rentabilidad, precio: redondear(costo * (1 + rentabilidad), 2) };
}
