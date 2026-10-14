import { AsyncLocalStorage } from 'async_hooks';

export interface LoggerContextData {
  requestId: string;
  merchantId?: string;
  [key: string]: any;
}

export const loggerContext = new AsyncLocalStorage<LoggerContextData>();
