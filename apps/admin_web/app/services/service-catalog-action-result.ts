import { AdminApiRequestError } from '../../lib/admin-api';

export function serviceCatalogApiFailure(error: unknown): {
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly message: string;
  readonly reauthRequired?: boolean;
} {
  if (!(error instanceof AdminApiRequestError)) {
    return { message: 'Service catalog could not be saved. Retry after checking the API connection.' };
  }
  const payload = readRecord(error.payload);
  const nested = readRecord(payload?.message);
  const fieldErrorsValue = readRecord(nested?.fieldErrors ?? payload?.fieldErrors);
  const fieldErrors = fieldErrorsValue
    ? Object.fromEntries(
        Object.entries(fieldErrorsValue).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : undefined;
  const errorCode =
    (typeof nested?.code === 'string' && nested.code) ||
    (typeof payload?.code === 'string' && payload.code) ||
    null;
  const message =
    errorCode === 'RECENT_REAUTH_REQUIRED'
      ? 'Confirm your password and MFA for this Admin session, then review and submit this unchanged catalog command again.'
      : (typeof nested?.message === 'string' && nested.message) ||
        (typeof payload?.message === 'string' && payload.message) ||
        (error.status === 409
          ? 'This service changed after the drawer opened. Reload and compare the latest values.'
          : 'The API rejected this catalog change. Review the fields and retry.');
  return {
    message,
    ...(errorCode === 'RECENT_REAUTH_REQUIRED' ? { reauthRequired: true } : {}),
    fieldErrors:
      errorCode === 'SERVICE_CATALOG_GROUP_KEY_EXISTS'
        ? { ...fieldErrors, serviceGroupKey: 'This service key is already in use.' }
        : fieldErrors,
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
