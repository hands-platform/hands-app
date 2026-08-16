type ConfigReader = {
  get<T = string>(key: string): T | undefined;
};

export function trustProxyFromConfig(config: ConfigReader): false | number {
  const raw = String(config.get<string>('TRUST_PROXY_HOPS') ?? '').trim();
  if (!raw) {
    return false;
  }

  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0 || hops > 3) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 3');
  }
  return hops === 0 ? false : hops;
}
