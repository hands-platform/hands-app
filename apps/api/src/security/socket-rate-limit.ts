type SocketRateLimitStore = {
  consumeRateLimit(key: string, windowMs: number): Promise<{ count: number }>;
};

export async function socketEventAllowed(
  store: SocketRateLimitStore | undefined,
  userId: string,
  event: string,
  max: number,
  windowMs = 60_000,
) {
  if (!store) {
    return process.env.NODE_ENV !== 'production';
  }

  try {
    const bucket = await store.consumeRateLimit(`socket:${event}:${userId}`, windowMs);
    return bucket.count <= max;
  } catch {
    return process.env.NODE_ENV !== 'production';
  }
}
