/**
 * Motor node:sqlite, solo para Node (pruebas y herramientas de línea de comandos).
 * No se exporta desde index.ts para que la app web no intente empaquetar módulos de Node.
 */
import { createRequire } from 'node:module';
import type { MotorSql, ParametroSql, SentenciaSql } from './motor.js';
import { BaseLocal } from './base.js';

// node:sqlite se carga con require: Vite/Vitest todavía no lo reconoce como módulo propio de Node.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

export class MotorNode implements MotorSql {
  private readonly db: InstanceType<typeof DatabaseSync>;
  constructor(ruta = ':memory:') { this.db = new DatabaseSync(ruta); }
  exec(sql: string): void { this.db.exec(sql); }
  prepare(sql: string): SentenciaSql {
    const st = this.db.prepare(sql);
    return {
      run: (p: ParametroSql[] = []) => ({ lastInsertRowid: Number(st.run(...p).lastInsertRowid) }),
      finalize: () => {},
    };
  }
  get<T>(sql: string, p: ParametroSql[] = []): T | undefined { return this.db.prepare(sql).get(...p) as T | undefined; }
  all<T>(sql: string, p: ParametroSql[] = []): T[] { return this.db.prepare(sql).all(...p) as T[]; }
  close(): void { this.db.close(); }
}

/** Abre (o crea) una base local en un archivo, con node:sqlite. */
export function abrirBaseNode(ruta = ':memory:'): BaseLocal {
  return new BaseLocal(new MotorNode(ruta));
}
