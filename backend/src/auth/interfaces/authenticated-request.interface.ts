import { Request } from 'express';

export interface AuthenticatedContext {
  merchantId: string;
  credentialId: string;
}

export interface AuthenticatedRequest extends Request {
  merchant: AuthenticatedContext;
}
