declare module "pg" {
  export type PoolConfig = Record<string, unknown>;

  export class Pool {
    constructor(config?: PoolConfig);
    query(text: string, params?: unknown[]): Promise<{
      rowCount: number;
      rows: any[];
    }>;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}

