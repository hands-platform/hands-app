export type ServiceCatalogActionState = {
  readonly status: 'idle' | 'error';
  readonly message?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly reauthRequired?: boolean;
};

export const initialServiceCatalogActionState: ServiceCatalogActionState = { status: 'idle' };

export type ServiceCatalogRefreshState = {
  readonly message?: string;
  readonly status: 'idle' | 'error' | 'refreshed';
};

export const initialServiceCatalogRefreshState: ServiceCatalogRefreshState = { status: 'idle' };
