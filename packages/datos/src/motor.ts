/**
 * Motor SQLite intercambiable. La lógica de la base local (base.ts) no sabe qué motor usa:
 * - en la app (pantallas web dentro de la ventana de Windows o del navegador) se usa sql.js (SQLite en WebAssembly);
 * - en las pruebas y en las herramientas de línea de comandos se usa node:sqlite (ver node.ts).
 */
export type ParametroSql = string | number | null;

export interface SentenciaSql {
  run(parametros?: ParametroSql[]): { lastInsertRowid: number };
  finalize(): void;
}

export interface MotorSql {
  exec(sql: string): void;
  prepare(sql: string): SentenciaSql;
  get<T = Record<string, unknown>>(sql: string, parametros?: ParametroSql[]): T | undefined;
  all<T = Record<string, unknown>>(sql: string, parametros?: ParametroSql[]): T[];
  close(): void;
}
