import { RequestIdMiddleware } from './request-id.middleware';
import { loggerContext } from '../logger/logger.context';

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('should generate a new request ID if none is provided', (done) => {
    const req = { headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;

    middleware.use(req, res, () => {
      expect(req.id).toBeDefined();
      expect(req.id.startsWith('req_')).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);

      const ctx = loggerContext.getStore();
      expect(ctx?.requestId).toBe(req.id);
      done();
    });
  });

  it('should preserve a valid provided request ID', (done) => {
    const validId = 'valid-req-id-12345';
    const req = { headers: { 'x-request-id': validId } } as any;
    const res = { setHeader: jest.fn() } as any;

    middleware.use(req, res, () => {
      expect(req.id).toBe(validId);
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', validId);
      done();
    });
  });

  it('should generate a new request ID if provided one is invalid', (done) => {
    const invalidId = 'toolshort';
    const req = { headers: { 'x-request-id': invalidId } } as any;
    const res = { setHeader: jest.fn() } as any;

    middleware.use(req, res, () => {
      expect(req.id).not.toBe(invalidId);
      expect(req.id.startsWith('req_')).toBe(true);
      done();
    });
  });
});
