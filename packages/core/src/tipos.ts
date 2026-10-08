/** Tipo de componente, tal como lo codifica Albamix: B = base, C = colorante, A = accesorio. */
export type TipoComponente = 'B' | 'C' | 'A';

/** Unidad de venta del componente: L = litros, K = kilos. */
export type Unidad = 'L' | 'K';

/** Sistema de colorantes: GVA es el actual; CONCENTRADOS es el sistema viejo (45000xx). */
export type SistemaColorantes = 'GVA' | 'CONCENTRADOS';

export interface Envase {
  /** Capacidad del envase en la unidad del componente (p. ej. 3.2 L, 16 L). */
  capacidad: number;
  /** Precio del envase completo, sin IVA. */
  precio: number;
}

export interface Componente {
  /** Código de 7 dígitos (p. ej. 4581000). */
  codigo: number;
  nombre: string;
  tipo: TipoComponente;
  unidad: Unidad;
  /** Peso específico en kg/L. */
  pesoEspecifico: number;
  /** Envases a la venta: [0] = chico (PRECIO1/CAPA1), [1] = grande (PRECIO2/CAPA2). */
  envases: Envase[];
  /** Solo bases: c.c. de base por cada 1000 c.c. de pintura terminada (p. ej. 850). */
  fraccionBase?: number;
  /** Bonificación sobre el costo, como fracción (0.05 = 5 %). */
  bonificacion?: number;
  /** Solo bases: rentabilidad que se aplica a toda la fórmula, como fracción (0.3184 = 31,84 %). */
  rentabilidad?: number;
}

export interface Renglon {
  linea: number;
  /** Código del componente. */
  comp: number;
  /** c.c. del componente por cada 1000 c.c. de pintura terminada. */
  cant: number;
}

export interface Formula {
  id?: number;
  /** Código de color (entero > 0). No es único: hay una fórmula por base. */
  codigo: number;
  nombre: string;
  obs?: string;
  fecha?: string;
  origen?: 'albamix' | 'personal';
  sistema?: SistemaColorantes;
  renglones: Renglon[];
  /** Capacidades propias de la fórmula (las usan las fórmulas personales), en la unidad indicada. */
  capacidades?: { capacidad: number; unidad: Unidad }[];
}

export type Catalogo = ReadonlyMap<number, Componente>;

export function crearCatalogo(componentes: Iterable<Componente>): Catalogo {
  const m = new Map<number, Componente>();
  for (const c of componentes) m.set(c.codigo, c);
  return m;
}
