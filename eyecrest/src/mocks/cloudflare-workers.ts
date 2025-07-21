// Mock for cloudflare:workers module
export class DurableObject {
  constructor(state: any, env: any) {}
}

export interface DurableObjectState {
  storage: {
    sql: any;
    setAlarm: (time: number) => Promise<void>;
    deleteAlarm: () => Promise<void>;
    getAlarm: () => Promise<number | null>;
  };
}

export interface DurableObjectNamespace {
  idFromName: (name: string) => string;
  get: (id: string) => any;
}