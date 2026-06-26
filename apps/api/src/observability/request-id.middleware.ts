import { randomUUID } from 'crypto';

type RequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  requestId?: string;
};

type ResponseLike = {
  statusCode?: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', callback: () => void): void;
};

type Next = () => void;

const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function requestPathWithoutQuery(req: RequestLike) {
  return (req.originalUrl ?? req.url ?? '').split('?')[0];
}

function safeIncomingRequestId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && SAFE_REQUEST_ID_PATTERN.test(candidate) ? candidate : undefined;
}

export function requestIdMiddleware(req: RequestLike, res: ResponseLike, next: Next) {
  const requestId = safeIncomingRequestId(req.headers?.['x-request-id']) || randomUUID();
  const startedAt = Date.now();

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const log = {
      level: 'info',
      event: 'http_request',
      requestId,
      method: req.method,
      path: requestPathWithoutQuery(req),
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      userAgent: req.headers?.['user-agent'],
    };
    console.log(JSON.stringify(log));
  });

  next();
}
