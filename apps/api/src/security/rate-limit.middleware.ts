type RequestLike = {
  ip?: string;
  method?: string;
  originalUrl?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type ResponseLike = {
  statusCode?: number;
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: unknown): void };
};

type Next = () => void;

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  pathPattern: RegExp;
  keyPathDepth?: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitStore = {
  consumeRateLimit(key: string, windowMs: number): Promise<Bucket>;
};

const buckets = new Map<string, Bucket>();

export const apiRateLimitPolicies: RateLimitOptions[] = [
  {
    windowMs: 15 * 60_000,
    max: 4,
    pathPattern: /^\/api\/auth\/admin-operator-login(?:\?|$)/,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 30,
    pathPattern: /^\/api\/auth\/(?!admin-operator-login(?:\?|$))/,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 120,
    pathPattern:
      /^\/api\/(?:customer\/(?:partners|providers)\/(?:nearby|[^/?]+)|public\/partners(?:\/[^/?]+)?)(?:\?|$)/i,
    keyPathDepth: 4,
  },
  {
    windowMs: 60_000,
    max: 120,
    pathPattern: /^\/api\/(?:partner|provider)\/bookings\/open(?:\?|$)/i,
    keyPathDepth: 4,
  },
  {
    windowMs: 60_000,
    max: 120,
    pathPattern:
      /^\/api\/(?:public\/site-pages(?:\/[^/?]+)*|services(?:\/groups)?|mobile\/app-version)(?:\?|$)/i,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 180,
    pathPattern: /^\/api\/payments\/[^/?]+\/callback(?:\?|$)/i,
    keyPathDepth: 2,
  },
  {
    windowMs: 60_000,
    max: 60,
    pathPattern: /^\/api\/app\/session(?:\?|$)/i,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 20,
    pathPattern: /^\/api\/files\/presign(?:\?|$)/i,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 30,
    pathPattern: /^\/api\/files\/[^/?]+\/(?:complete|read-url)(?:\?|$)/i,
    keyPathDepth: 2,
  },
  {
    windowMs: 60_000,
    max: 120,
    pathPattern: /^\/api\/chat\/rooms\/[^/?]+\/messages(?:\?|$)/i,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 30,
    pathPattern: /^\/api\/customer\/bookings(?:\/[^/?]+(?:\/[^/?]+)?)?(?:\?|$)/i,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 60,
    pathPattern: /^\/api\/(?:partner|provider)\/bookings\/[^/?]+\/(?:join|accept|reject|arrived|start|complete|cancel|customer-evaluation)(?:\?|$)/i,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 30,
    pathPattern: /^\/api\/customer\/locations(?:\/[^/?]+)?(?:\?|$)/i,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 60,
    pathPattern: /^\/api\/(?:partner|provider)\/location(?:\?|$)/i,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 30,
    pathPattern: /^\/api\/notifications\/(?:device-token|provider-chat|[^/?]+\/read)(?:\/[^/?]+)?(?:\?|$)/i,
    keyPathDepth: 3,
  },
  {
    windowMs: 60_000,
    max: 600,
    pathPattern: /^\/api\/health(?:\/ready)?(?:\?|$)/i,
    keyPathDepth: 2,
  },
];

export function rateLimitMiddleware(options: RateLimitOptions, store?: RateLimitStore) {
  return async (req: RequestLike, res: ResponseLike, next: Next) => {
    const path = req.originalUrl ?? req.url ?? '';
    if (!options.pathPattern.test(path)) {
      next();
      return;
    }

    const now = Date.now();
    const key = `${clientId(req)}:${req.method ?? 'GET'}:${pathKey(path, options.keyPathDepth)}`;
    let active: Bucket;
    if (store) {
      try {
        active = await store.consumeRateLimit(key, options.windowMs);
      } catch {
        if (process.env.NODE_ENV === 'production') {
          res.status(503).json({
            statusCode: 503,
            message: 'Request protection is temporarily unavailable',
          });
          return;
        }
        active = consumeLocalBucket(key, now, options.windowMs);
      }
    } else {
      active = consumeLocalBucket(key, now, options.windowMs);
    }

    const remaining = Math.max(options.max - active.count, 0);
    res.setHeader('x-ratelimit-limit', String(options.max));
    res.setHeader('x-ratelimit-remaining', String(remaining));
    res.setHeader('x-ratelimit-reset', String(Math.ceil(active.resetAt / 1000)));

    if (active.count > options.max) {
      res.setHeader('retry-after', String(Math.ceil((active.resetAt - now) / 1000)));
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests',
        retryAfterSeconds: Math.ceil((active.resetAt - now) / 1000),
      });
      return;
    }

    if (!store) cleanupExpired(now);
    next();
  };
}

function consumeLocalBucket(key: string, now: number, windowMs: number) {
  const bucket = buckets.get(key);
  const active = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + windowMs };
  active.count += 1;
  buckets.set(key, active);
  return active;
}

function clientId(req: RequestLike) {
  return req.ip || 'unknown';
}

function pathKey(path: string, keyPathDepth?: number) {
  const pathname = path.split('?')[0] || '/';

  if (!keyPathDepth || keyPathDepth <= 0) {
    return pathname;
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= keyPathDepth) {
    return pathname;
  }

  return `/${segments.slice(0, keyPathDepth).join('/')}`;
}

function cleanupExpired(now: number) {
  if (buckets.size < 1000) {
    return;
  }

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
