export type PushProvider = 'in_app_only' | 'fcm';

export function resolvePushProvider(input: { configured?: string | null; override?: PushProvider }) {
  const configured = input.configured?.trim().toLowerCase();
  return input.override ?? (configured === 'fcm' ? 'fcm' : 'in_app_only');
}
