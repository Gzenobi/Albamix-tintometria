import type { MotorSql } from './motor.js';
import type { Componente, Formula, SistemaColorantes, Unidad, TipoComponente } from '@albamix/core';
import type { Importacion } from './importar.js';

/** Versión del esquema de la base local. Subirla cuando cambie el esquema. */
export const VERSION_ESQUEMA = 1;

export const ESQUEMA = `
CREATE TABLE IF NOT EXISTS paquete (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS componente (
  codigo INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('B','C','A')),
  unidad TEXT NOT NULL CHECK (unidad IN ('L','K')),
  peso_especifico REAL NOT NULL,
  bonificacion REAL,
  rentabilidad REAL,
  fraccion_base REAL
);
CREATE TABLE IF NOT EXISTS envase (
  componente INTEGER NOT NULL REFERENCES componente(codigo) ON DELETE CASCADE,
  orden INTEGER NOT NULL,
  capacidad REAL NOT NULL,
  precio REAL NOT NULL,
  PRIMARY KEY (componente, orden)
);
CREATE TABLE IF NOT EXISTS formula (
  id INTEGER PRIMARY KEY,
  origen TEXT NOT NULL CHECK (origen IN ('albamix','personal')),
  id_origen INTEGER,
  codigo INTEGER NOT NULL CHECK (codigo > 0),
  nombre TEXT NOT NULL,
  obs TEXT,
  fecha TEXT,
  sistema TEXT NOT NULL CHECK (sistema IN ('GVA','CONCENTRADOS')),
  base INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS formula_codigo ON formula (codigo);
CREATE INDEX IF NOT EXISTS formula_base ON formula (base);
CREATE INDEX IF NOT EXISTS formula_fecha ON formula (fecha);
CREATE TABLE IF NOT EXISTS renglon (
  formula INTEGER NOT NULL REFERENCES formula(id) ON DELETE CASCADE,
  linea INTEGER NOT NULL,
  componente INTEGER NOT NULL,
  cant REAL NOT NULL CHECK (cant > 0),
  PRIMARY KEY (formula, linea)
);
CREATE INDEX IF NOT EXISTS renglon_componente ON renglon (componente);
CREATE TABLE IF NOT EXISTS capacidad_formula (
  formula INTEGER NOT NULL REFERENCES formula(id) ON DELETE CASCADE,
  capacidad REAL NOT NULL,
  unidad TEXT NOT NULL CHECK (unidad IN ('L','K'))
);
`;

export interface ResumenFormula {
  id: number;
  codigo: number;
  nombre: string;
  fecha: string | null;
  origen: 'albamix' | 'personal';
  sistema: SistemaColorantes;
  base: number;
  baseNombre: string | null;
}

export interface FiltroBusqueda {
  /** Código (prefijo, si es número) o parte del nombre. */
  texto?: string;
  codigoDesde?: number;
  codigoHasta?: number;
  /** AAAA-MM-DD, inclusive. */
  fechaDesde?: string;
  fechaHasta?: string;
  base?: number;
  origen?: 'albamix' | 'personal';
  sistema?: SistemaColorantes;
  orden?: 'codigo' | 'nombre' | 'fecha';
  descendente?: boolean;
  limite?: number;
  desde?: number;
}

export class BaseLocal {
  constructor(readonly db: MotorSql) {
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec(ESQUEMA);
  }

  cerrar(): void { this.db.close(); }

  /** Cantidad de fórmulas cargadas (0 = la app todavía no tiene datos). */
  cantidadFormulas(): number { return this.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM formula')!.n; }

  /** Reemplaza el contenido por una importación completa, en una sola transacción. */
  cargar(imp: Importacion, meta: Record<string, string> = {}): void {
    const d = this.db;
    d.exec('BEGIN');
    try {
      d.exec('DELETE FROM capacidad_formula; DELETE FROM renglon; DELETE FROM formula; DELETE FROM envase; DELETE FROM componente; DELETE FROM paquete;');
      const insComp = d.prepare('INSERT INTO componente VALUES (?,?,?,?,?,?,?,?)');
      const insEnv = d.prepare('INSERT INTO envase VALUES (?,?,?,?)');
      for (const c of imp.componentes) {
        insComp.run([c.codigo, c.nombre, c.tipo, c.unidad, c.pesoEspecifico, c.bonificacion ?? null, c.rentabilidad ?? null, c.fraccionBase ?? null]);
        c.envases.forEach((e, i) => insEnv.run([c.codigo, i, e.capacidad, e.precio]));
      }
      const insF = d.prepare('INSERT INTO formula (origen,id_origen,codigo,nombre,obs,fecha,sistema,base) VALUES (?,?,?,?,?,?,?,?)');
      const insR = d.prepare('INSERT INTO renglon VALUES (?,?,?,?)');
      const insCap = d.prepare('INSERT INTO capacidad_formula VALUES (?,?,?)');
      for (const f of imp.formulas) {
        const r = insF.run([f.origen ?? 'albamix', f.id ?? null, f.codigo, f.nombre, f.obs ?? null, f.fecha ?? null, f.sistema ?? 'GVA', f.renglones[0]!.comp]);
        const id = Number(r.lastInsertRowid);
        for (const rg of f.renglones) insR.run([id, rg.linea, rg.comp, rg.cant]);
        for (const k of f.capacidades ?? []) insCap.run([id, k.capacidad, k.unidad]);
      }
      const insMeta = d.prepare('INSERT INTO paquete VALUES (?,?)');
      const todo = { version_esquema: String(VERSION_ESQUEMA), creado: new Date().toISOString(), ...meta, reporte: JSON.stringify(imp.reporte) };
      for (const [k, v] of Object.entries(todo)) insMeta.run([k, v]);
      d.exec('COMMIT');
    } catch (e) {
      d.exec('ROLLBACK');
      throw e;
    }
  }

  /**
   * Reemplaza el maestro de productos y precios (lista de precios nueva) sin tocar las fórmulas.
   * Rechaza una lista que no sea posterior a la vigente, salvo que se fuerce.
   */
  actualizarPrecios(componentes: Componente[], lista: { numero: string; vigencia: string; notas?: string }, forzar = false): void {
    const actual = this.meta().lista_precios_numero;
    if (actual && !forzar && lista.numero.localeCompare(actual, 'es', { numeric: true }) <= 0) {
      throw new Error(`La lista ${lista.numero} no es posterior a la vigente (${actual}).`);
    }
    const d = this.db;
    d.exec('BEGIN');
    try {
      d.exec('DELETE FROM envase; DELETE FROM componente;');
      const insComp = d.prepare('INSERT INTO componente VALUES (?,?,?,?,?,?,?,?)');
      const insEnv = d.prepare('INSERT INTO envase VALUES (?,?,?,?)');
      for (const c of componentes) {
        insComp.run([c.codigo, c.nombre, c.tipo, c.unidad, c.pesoEspecifico, c.bonificacion ?? null, c.rentabilidad ?? null, c.fraccionBase ?? null]);
        c.envases.forEach((e, i) => insEnv.run([c.codigo, i, e.capacidad, e.precio]));
      }
      const set = d.prepare('INSERT INTO paquete VALUES (?,?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
      set.run(['lista_precios_numero', lista.numero]);
      set.run(['lista_precios_vigencia', lista.vigencia]);
      set.run(['lista_precios_notas', lista.notas ?? '']);
      d.exec('COMMIT');
    } catch (e) {
      d.exec('ROLLBACK');
      throw e;
    }
  }

  meta(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const r of this.db.all<{ clave: string; valor: string }>('SELECT clave, valor FROM paquete')) out[r.clave] = r.valor;
    return out;
  }

  componentes(): Componente[] {
    const envases = new Map<number, { capacidad: number; precio: number }[]>();
    for (const e of this.db.all<{ componente: number; capacidad: number; precio: number }>('SELECT componente, capacidad, precio FROM envase ORDER BY componente, orden')) {
      const l = envases.get(e.componente) ?? []; l.push({ capacidad: e.capacidad, precio: e.precio }); envases.set(e.componente, l);
    }
    return this.db.all('SELECT * FROM componente ORDER BY codigo').map((c) => ({
      codigo: c.codigo as number,
      nombre: c.nombre as string,
      tipo: c.tipo as TipoComponente,
      unidad: c.unidad as Unidad,
      pesoEspecifico: c.peso_especifico as number,
      envases: envases.get(c.codigo as number) ?? [],
      ...(c.bonificacion != null ? { bonificacion: c.bonificacion as number } : {}),
      ...(c.rentabilidad != null ? { rentabilidad: c.rentabilidad as number } : {}),
      ...(c.fraccion_base != null ? { fraccionBase: c.fraccion_base as number } : {}),
    }));
  }

  formula(id: number): Formula | undefined {
    const f = this.db.get('SELECT * FROM formula WHERE id = ?', [id]);
    if (!f) return undefined;
    const renglones = this.db.all<{ linea: number; comp: number; cant: number }>('SELECT linea, componente AS comp, cant FROM renglon WHERE formula = ? ORDER BY linea', [id])
      .map((r) => ({ linea: r.linea, comp: r.comp, cant: r.cant }));
    const capacidades = this.db.all<{ capacidad: number; unidad: Unidad }>('SELECT capacidad, unidad FROM capacidad_formula WHERE formula = ?', [id])
      .map((k) => ({ capacidad: k.capacidad, unidad: k.unidad }));
    return {
      id, codigo: f.codigo as number, nombre: f.nombre as string,
      origen: f.origen as 'albamix' | 'personal', sistema: f.sistema as SistemaColorantes,
      renglones,
      ...(f.obs ? { obs: f.obs as string } : {}),
      ...(f.fecha ? { fecha: f.fecha as string } : {}),
      ...(capacidades.length ? { capacidades } : {}),
    };
  }

  /** Búsqueda del MVP: código o nombre, rangos de código y fecha, producto, origen y orden. */
  buscar(filtro: FiltroBusqueda = {}): { total: number; filas: ResumenFormula[] } {
    const where: string[] = [], args: (string | number)[] = [];
    const texto = filtro.texto?.trim().replace(/\s+/g, ' ');
    if (texto) {
      if (/^\d+$/.test(texto)) { where.push("(CAST(f.codigo AS TEXT) LIKE ? OR f.nombre LIKE ?)"); args.push(`${texto}%`, `%${texto}%`); }
      else { where.push('f.nombre LIKE ?'); args.push(`%${texto}%`); }
    }
    if (filtro.codigoDesde != null) { where.push('f.codigo >= ?'); args.push(filtro.codigoDesde); }
    if (filtro.codigoHasta != null) { where.push('f.codigo <= ?'); args.push(filtro.codigoHasta); }
    if (filtro.fechaDesde) { where.push('f.fecha >= ?'); args.push(filtro.fechaDesde); }
    if (filtro.fechaHasta) { where.push('f.fecha <= ?'); args.push(filtro.fechaHasta); }
    if (filtro.base != null) { where.push('f.base = ?'); args.push(filtro.base); }
    if (filtro.origen) { where.push('f.origen = ?'); args.push(filtro.origen); }
    if (filtro.sistema) { where.push('f.sistema = ?'); args.push(filtro.sistema); }
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const dir = filtro.descendente ? 'DESC' : 'ASC';
    const orden = { codigo: `f.codigo ${dir}, b.nombre`, nombre: `f.nombre ${dir}, f.codigo`, fecha: `f.fecha ${dir}, f.codigo` }[filtro.orden ?? 'codigo'];
    const total = this.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM formula f ${w}`, args)!.n;
    const filas = this.db.all<ResumenFormula>(`
      SELECT f.id, f.codigo, f.nombre, f.fecha, f.origen, f.sistema, f.base, b.nombre AS baseNombre
      FROM formula f LEFT JOIN componente b ON b.codigo = f.base ${w}
      ORDER BY ${orden} LIMIT ? OFFSET ?`, [...args, filtro.limite ?? 300, filtro.desde ?? 0]);
    return { total, filas };
  }
}
