import { adminGet } from './admin-api';

type AdminResourceLoader<T> = (path: string, fallback: T) => Promise<T>;

type AdminResourceClientOptions<T> = {
  readonly load?: AdminResourceLoader<T>;
  readonly mockData: T;
  readonly path: string;
};

type AdminResourceClient<T> = {
  readonly list: () => Promise<T>;
  readonly mockData: T;
  readonly path: string;
};

export function createAdminResourceClient<T>({
  load = adminGet,
  mockData,
  path,
}: AdminResourceClientOptions<T>): AdminResourceClient<T> {
  return {
    list: () => load(path, mockData),
    mockData,
    path,
  };
}
