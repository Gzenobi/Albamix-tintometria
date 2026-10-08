import type { Dosificacion } from './dosificacion.js';

/** Por debajo de este peso, una balanza común de mostrador no es confiable. */
export const UMBRAL_GRAMOS_POR_DEFECTO = 2;

export interface AvisoCantidadChica {
  linea: number;
  codigo: number;
  nombre: string;
  gramos: number;
}

export interface ResultadoCantidadesChicas {
  avisos: AvisoCantidadChica[];
  /** Capacidad mínima (L) para que todos los componentes superen el umbral. */
  capacidadMinima?: number;
  /** Índice del envase de base con el que alcanza, si alguno alcanza. */
  envaseSugerido?: number;
}

/**
 * Detecta componentes con menos gramos que el umbral (p. ej. 1,7 g de azul) y sugiere
 * la capacidad mínima, o el envase de base, para pesarlos con seguridad.
 */
export function avisarCantidadesChicas(
  d: Dosificacion,
  umbralGramos = UMBRAL_GRAMOS_POR_DEFECTO,
): ResultadoCantidadesChicas {
  const avisos = d.renglones
    .filter((r) => r.gramos < umbralGramos)
    .map((r) => ({ linea: r.linea, codigo: r.componente.codigo, nombre: r.componente.nombre, gramos: r.gramos }));
  if (avisos.length === 0) return { avisos };

  const minGramos = Math.min(...avisos.map((a) => a.gramos));
  const capacidadMinima = d.capacidad * (umbralGramos / minGramos);

  const base = d.renglones[0];
  let envaseSugerido: number | undefined;
  if (base) {
    const fraccion = base.cant / 1000;
    const idx = base.componente.envases.findIndex((e) => e.capacidad / fraccion >= capacidadMinima);
    if (idx >= 0) envaseSugerido = idx;
  }
  return { avisos, capacidadMinima, envaseSugerido };
}

export interface RenglonCorregido {
  linea: number;
  codigo: number;
  nombre: string;
  /** Gramos que la fórmula pedía originalmente. */
  gramosOriginales: number;
  /** Gramos totales que debe tener ahora para conservar el color. */
  gramosNuevos: number;
  /** Lo que falta agregar de este componente (para los ya vertidos, solo la diferencia). */
  agregar: number;
  /** Lo que la balanza tiene que marcar al terminar este componente, en el nuevo orden. */
  acumulado: number;
  yaVertido: boolean;
}

export interface Correccion {
  /** Cuánto se agrandó la tanda (1,10 = 10 % más). */
  factor: number;
  capacidadNueva: number;
  renglones: RenglonCorregido[];
  /** Hay que agregar base de otra lata (la base ya estaba vertida completa). */
  requiereMasBase: boolean;
}

/**
 * "Me pasé": el operador vertió de más un componente. Para conservar el color hay que
 * agrandar toda la tanda en la misma proporción. Devuelve cuánto agregar de cada componente:
 * de los ya vertidos, solo la diferencia; de los que faltan, la cantidad completa escalada.
 *
 * @param indice  posición del componente en el que se pasó (0 = base)
 * @param gramosReales  lo que realmente quedó de ese componente
 * @param vertidos  cuántos componentes ya estaban completos antes del que se pasó (normalmente = indice)
 */
export function corregirExceso(d: Dosificacion, indice: number, gramosReales: number, vertidos = indice): Correccion {
  const objetivo = d.renglones[indice];
  if (!objetivo) throw new RangeError(`No existe el paso ${indice + 1}.`);
  if (!(gramosReales > 0)) throw new RangeError('Los gramos reales deben ser mayores que cero.');

  const factor = Math.max(1, gramosReales / objetivo.gramos);
  let acumulado = 0;
  const renglones = d.renglones.map((r, i): RenglonCorregido => {
    const yaVertido = i < vertidos || i === indice;
    const gramosNuevos = i === indice ? gramosReales : r.gramos * factor;
    const agregar = i === indice ? 0 : yaVertido ? gramosNuevos - r.gramos : gramosNuevos;
    acumulado += gramosNuevos;
    return {
      linea: r.linea, codigo: r.componente.codigo, nombre: r.componente.nombre,
      gramosOriginales: r.gramos, gramosNuevos, agregar, acumulado, yaVertido,
    };
  });

  const base = renglones[0];
  return {
    factor,
    capacidadNueva: d.capacidad * factor,
    renglones,
    requiereMasBase: factor > 1 && !!base && base.yaVertido && d.envaseBase >= 0,
  };
}
