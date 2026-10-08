import {
  validarFormula, crearCatalogo,
  type Componente, type Formula, type SistemaColorantes, type TipoComponente, type Unidad,
} from '@albamix/core';
import { BaseJet1, type Fila } from './jet1.js';

/** Resultado de leer las .mdb originales, listo para guardar en la base local. */
export interface Importacion {
  componentes: Componente[];
  formulas: Formula[];
  reporte: Reporte;
}

export interface Reporte {
  componentes: number;
  formulasAlbamix: number;
  formulasPersonales: number;
  renglones: number;
  /** Fórmulas descartadas por no tener renglones (datos basura del original). */
  descartadasSinRenglones: { origen: string; id: number; codigo: number }[];
  /** Nombres corregidos solo en espacios ("IRAM 05-1-020  AMARILLO" → "IRAM 05-1-020 AMARILLO"). */
  nombresNormalizados: number;
  /** Pares código de color + base con más de una fórmula (el original lo permite con advertencia). */
  duplicadosCodigoBase: number;
  /** Fórmulas que no pasan la validación del original, por código de problema. */
  problemasValidacion: Record<string, number>;
  /** Componentes usados en fórmulas que no están en el maestro de productos. */
  componentesFaltantes: number[];
}

export interface ArchivosOriginales {
  /** precios.mdb: maestro de productos (obligatorio). */
  precios: Uint8Array;
  /** albamix.mdb: fórmulas oficiales. */
  albamix?: Uint8Array;
  /** personal.mdb: fórmulas cargadas a mano por el distribuidor. */
  personal?: Uint8Array;
  /** bonifica.mdb: bonificación por producto. */
  bonifica?: Uint8Array;
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const txt = (v: unknown): string => (typeof v === 'string' ? v : '');
const unaLinea = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Lee el maestro de productos de precios.mdb (+ bonificaciones de bonifica.mdb si está). */
export function leerComponentes(precios: Uint8Array, bonifica?: Uint8Array): Componente[] {
  const bonif = new Map<number, number>();
  if (bonifica) {
    for (const f of new BaseJet1(bonifica).leerTabla('Componentes')) bonif.set(num(f.COMP), num(f.BONIF));
  }
  return new BaseJet1(precios).leerTabla('Componentes').map((f): Componente => {
    const envases = [[f.CAPA1, f.PRECIO1], [f.CAPA2, f.PRECIO2]]
      .map(([c, p]) => ({ capacidad: num(c), precio: num(p) }))
      .filter((e) => e.capacidad > 0);
    const tipo = (['B', 'C', 'A'].includes(txt(f.TIPO)) ? txt(f.TIPO) : 'C') as TipoComponente;
    const codigo = num(f.COMP);
    const b = bonif.get(codigo);
    return {
      codigo,
      nombre: unaLinea(txt(f.NOMBRE)),
      tipo,
      unidad: (txt(f.UNIDAD) === 'K' ? 'K' : 'L') as Unidad,
      pesoEspecifico: num(f.PE),
      envases,
      // SUPUESTO: el original guarda la bonificación como porcentaje (en los datos reales vale 0).
      ...(b ? { bonificacion: b / 100 } : {}),
    };
  });
}

/** Lee FormulasC / FormulasR / FormulasCap de albamix.mdb o personal.mdb. */
export function leerFormulas(mdb: Uint8Array, origen: 'albamix' | 'personal', reporte?: Reporte): Formula[] {
  const db = new BaseJet1(mdb);
  const renglones = agrupar(db.leerTabla('FormulasR'));
  const capacidades = agrupar(db.tablas().has('FormulasCap') ? db.leerTabla('FormulasCap') : []);
  const out: Formula[] = [];
  for (const c of db.leerTabla('FormulasC')) {
    const id = num(c.ID), codigo = num(c.CODIGO);
    const rs = (renglones.get(id) ?? [])
      .map((r) => ({ linea: num(r.LINEA), comp: num(r.COMP), cant: num(r.CANT) }))
      .sort((a, b) => a.linea - b.linea);
    if (rs.length === 0) { reporte?.descartadasSinRenglones.push({ origen, id, codigo }); continue; }
    const nombreOriginal = txt(c.NOMBRE), nombre = unaLinea(nombreOriginal);
    if (reporte && nombre !== nombreOriginal.trim()) reporte.nombresNormalizados++;
    const caps = (capacidades.get(id) ?? []).map((k) => ({ capacidad: num(k.CAPA), unidad: (txt(k.UNIDAD) === 'K' ? 'K' : 'L') as Unidad }));
    const fecha = c.FECHA instanceof Date ? c.FECHA.toISOString().slice(0, 10) : undefined;
    out.push({
      id, codigo, nombre, origen,
      sistema: detectarSistema(rs.map((r) => r.comp)),
      renglones: rs,
      ...(txt(c.OBS).trim() ? { obs: txt(c.OBS).trim() } : {}),
      ...(fecha ? { fecha } : {}),
      ...(caps.length ? { capacidades: caps } : {}),
    });
  }
  return out;
}

/** Los colorantes "Concentrado" del sistema viejo empiezan con 4500; los GVA actuales con 4600. */
export function detectarSistema(componentes: number[]): SistemaColorantes {
  return componentes.some((c) => Math.floor(c / 1000) === 4500) ? 'CONCENTRADOS' : 'GVA';
}

/** Importa todas las bases originales disponibles y arma el reporte de calidad de datos. */
export function importarOriginales(a: ArchivosOriginales): Importacion {
  const reporte: Reporte = {
    componentes: 0, formulasAlbamix: 0, formulasPersonales: 0, renglones: 0,
    descartadasSinRenglones: [], nombresNormalizados: 0, duplicadosCodigoBase: 0,
    problemasValidacion: {}, componentesFaltantes: [],
  };
  const componentes = leerComponentes(a.precios, a.bonifica);
  const albamix = a.albamix ? leerFormulas(a.albamix, 'albamix', reporte) : [];
  const personal = a.personal ? leerFormulas(a.personal, 'personal', reporte) : [];
  const formulas = [...albamix, ...personal];

  const catalogo = crearCatalogo(componentes);
  const faltantes = new Set<number>();
  const pares = new Map<string, number>();
  for (const f of formulas) {
    for (const r of f.renglones) if (!catalogo.has(r.comp)) faltantes.add(r.comp);
    const k = `${f.origen}|${f.codigo}|${f.renglones[0]?.comp}`;
    pares.set(k, (pares.get(k) ?? 0) + 1);
    for (const e of validarFormula(f, catalogo).errores) {
      reporte.problemasValidacion[e.codigo] = (reporte.problemasValidacion[e.codigo] ?? 0) + 1;
    }
  }
  reporte.componentes = componentes.length;
  reporte.formulasAlbamix = albamix.length;
  reporte.formulasPersonales = personal.length;
  reporte.renglones = formulas.reduce((s, f) => s + f.renglones.length, 0);
  reporte.duplicadosCodigoBase = [...pares.values()].filter((n) => n > 1).reduce((s, n) => s + n - 1, 0);
  reporte.componentesFaltantes = [...faltantes].sort((x, y) => x - y);
  return { componentes, formulas, reporte };
}

function agrupar(filas: Fila[]): Map<number, Fila[]> {
  const m = new Map<number, Fila[]>();
  for (const f of filas) { const id = num(f.ID); const l = m.get(id) ?? []; l.push(f); m.set(id, l); }
  return m;
}
