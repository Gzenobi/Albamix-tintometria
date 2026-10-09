import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import type { MotorSql, ParametroSql, SentenciaSql } from './motor.js';

let sqlJs: Promise<SqlJsStatic> | undefined;

/**
 * Inicializa sql.js una sola vez. `ubicarWasm` devuelve la URL del archivo sql-wasm.wasm
 * (la app lo sirve junto con sus archivos; en Node se resuelve solo).
 */
export function iniciarSqlJs(ubicarWasm?: (archivo: string) => string): Promise<SqlJsStatic> {
  sqlJs ??= initSqlJs(ubicarWasm ? { locateFile: ubicarWasm } : undefined);
  return sqlJs;
}

/** Motor SQLite en WebAssembly. Se puede abrir vacío o desde los bytes de un archivo .sqlite. */
export class MotorSqlJs implements MotorSql {
  constructor(private readonly db: Database) {}

  static async abrir(bytes?: Uint8Array, ubicarWasm?: (archivo: string) => string): Promise<MotorSqlJs> {
    const SQL = await iniciarSqlJs(ubicarWasm);
    return new MotorSqlJs(bytes ? new SQL.Database(bytes) : new SQL.Database());
  }

  exec(sql: string): void { this.db.exec(sql); }

  prepare(sql: string): SentenciaSql {
    const st = this.db.prepare(sql);
    const db = this.db;
    return {
      run(parametros: ParametroSql[] = []) {
        st.run(parametros);
        const r = db.exec('SELECT last_insert_rowid()');
        return { lastInsertRowid: Number(r[0]?.values[0]?.[0] ?? 0) };
      },
      finalize() { st.free(); },
    };
  }

  get<T>(sql: string, parametros: ParametroSql[] = []): T | undefined {
    return this.all<T>(sql, parametros)[0];
  }

  all<T>(sql: string, parametros: ParametroSql[] = []): T[] {
    const st = this.db.prepare(sql);
    try {
      st.bind(parametros);
      const out: T[] = [];
      while (st.step()) out.push(st.getAsObject() as T);
      return out;
    } finally {
      st.free();
    }
  }

  /** Bytes del archivo .sqlite, para guardarlo en disco. */
  exportar(): Uint8Array { return this.db.export(); }

  close(): void { this.db.close(); }
}
