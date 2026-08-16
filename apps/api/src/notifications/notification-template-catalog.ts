import { Role } from '@prisma/client';

export const NOTIFICATION_TEMPLATE_LOCALES = ['en', 'vi', 'ko', 'ja', 'zh'] as const;

export type NotificationTemplateLocale = (typeof NOTIFICATION_TEMPLATE_LOCALES)[number];

export type DefaultNotificationTemplate = {
  readonly key: string;
  readonly audience: Extract<Role, 'CUSTOMER' | 'PROVIDER'>;
  readonly channel: 'BOTH' | 'IN_APP' | 'PUSH';
  readonly description: string;
  readonly requiredVariables: readonly string[];
  readonly variables: readonly string[];
  readonly title: string;
  readonly body: string;
};

export type NotificationTemplateRoute = {
  readonly type: string;
  readonly targetRole: Extract<Role, 'CUSTOMER' | 'PROVIDER'>;
  readonly templateKey: string;
  readonly payloadVariables: readonly string[];
};

export type NotificationTemplateOpenBehavior = {
  readonly payloadKeys: readonly string[];
  readonly possibleDestinations: readonly string[];
  readonly summary: string;
  readonly variesByPayload: boolean;
};

export const DEFAULT_NOTIFICATION_TEMPLATES: readonly DefaultNotificationTemplate[] = [
  {
    key: 'booking.opened',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer confirmation after a booking request is created.',
    requiredVariables: [],
    variables: [],
    title: 'Booking opened',
    body: 'We are looking for nearby partners.',
  },
  {
    key: 'booking.requested',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Direct first-pick booking request sent to a Partner.',
    requiredVariables: [],
    variables: [],
    title: 'New direct booking request',
    body: 'A customer requested one of your services.',
  },
  {
    key: 'booking.backup_available',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Marketplace/open request available to eligible nearby Partners.',
    requiredVariables: [],
    variables: [],
    title: 'Nearby booking available',
    body: 'A nearby customer request is open for marketplace participation.',
  },
  {
    key: 'provider.joined',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice when a Partner joins a booking request.',
    requiredVariables: ['partnerName'],
    variables: ['partnerName'],
    title: 'A partner joined',
    body: '{partnerName} joined your booking.',
  },
  {
    key: 'booking.matched',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice when a Partner is matched and chat is ready.',
    requiredVariables: [],
    variables: [],
    title: 'Partner matched',
    body: 'Your chat room is ready.',
  },
  {
    key: 'booking.matched.partner',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner notice after being selected or first-pick matched.',
    requiredVariables: [],
    variables: [],
    title: 'You were matched',
    body: 'The customer selected you for this booking.',
  },
  {
    key: 'booking.rejected',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice when a requested Partner cannot accept.',
    requiredVariables: [],
    variables: [],
    title: 'Partner declined your booking',
    body: 'We are still looking for another available partner.',
  },
  {
    key: 'provider.accepted',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice that a marketplace Partner is ready.',
    requiredVariables: ['partnerName'],
    variables: ['partnerName'],
    title: 'Marketplace partner is ready',
    body: '{partnerName} can take this booking. Select this partner if you want to switch.',
  },
  {
    key: 'provider.rejected',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice that a marketplace Partner declined.',
    requiredVariables: ['partnerName'],
    variables: ['partnerName'],
    title: 'Partner declined',
    body: '{partnerName} cannot take this booking.',
  },
  {
    key: 'service.started',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice when the Partner starts service.',
    requiredVariables: [],
    variables: [],
    title: 'Service started',
    body: 'Your partner started the service. Continue in the matched chat if needed.',
  },
  {
    key: 'service.started.partner',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner notice when service starts.',
    requiredVariables: [],
    variables: [],
    title: 'Service started',
    body: 'Continue with the customer in the matched chat if needed.',
  },
  {
    key: 'service.completed',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice after service completion.',
    requiredVariables: [],
    variables: [],
    title: 'Service completed',
    body: 'Please leave a review when you are ready.',
  },
  {
    key: 'earning.created',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner notice when completed work is added to earnings.',
    requiredVariables: [],
    variables: [],
    title: 'Earning created',
    body: 'Your completed service has been added to earnings.',
  },
  {
    key: 'payment.updated',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer notice for payment status changes.',
    requiredVariables: [],
    variables: [],
    title: 'Payment updated',
    body: 'Your booking payment status was updated.',
  },
  {
    key: 'chat.message',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer alert when a Partner sends a booking chat message.',
    requiredVariables: [],
    variables: [],
    title: 'New chat message',
    body: 'A new message is available in your booking chat.',
  },
  {
    key: 'chat.message.partner',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner alert when a Customer sends a booking chat message.',
    requiredVariables: [],
    variables: [],
    title: 'New chat message',
    body: 'A new message is available in your booking chat.',
  },
  {
    key: 'booking.cancelled',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer booking cancellation notice.',
    requiredVariables: [],
    variables: [],
    title: 'Booking cancelled',
    body: 'Your request has been cancelled.',
  },
  {
    key: 'booking.cancelled.partner',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner notice when a booking request closes before commitment.',
    requiredVariables: [],
    variables: [],
    title: 'Booking cancelled',
    body: 'This booking request is no longer available.',
  },
  {
    key: 'booking.no_show',
    audience: Role.CUSTOMER,
    channel: 'BOTH',
    description: 'Customer no-show review notice.',
    requiredVariables: [],
    variables: [],
    title: 'No-show under review',
    body: 'HANDS operations marked this booking as no-show. Payment and support review is pending.',
  },
  {
    key: 'booking.no_show.partner',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner no-show review notice.',
    requiredVariables: [],
    variables: [],
    title: 'Booking marked no-show',
    body: 'HANDS operations marked this booking as no-show. Check the booking note before fee or payout follow-up.',
  },
  {
    key: 'provider.account.blocked',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner account blocked notice.',
    requiredVariables: [],
    variables: [],
    title: 'Partner account blocked',
    body: 'Your HANDS partner account is under admin review. Open the app for details.',
  },
  {
    key: 'provider.account.unblocked',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner account unblocked notice.',
    requiredVariables: [],
    variables: [],
    title: 'Partner account unblocked',
    body: 'Your HANDS partner account can sign in again. Go online only when ready to receive requests.',
  },
  {
    key: 'provider.payout_setup_required',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner payout setup notice after first earning.',
    requiredVariables: [],
    variables: [],
    title: 'Payout setup required',
    body: 'Your first HANDS earning is recorded. Add payout setup before requesting payout.',
  },
  {
    key: 'provider.payout_batch.updated',
    audience: Role.PROVIDER,
    channel: 'BOTH',
    description: 'Partner payout batch status update.',
    requiredVariables: [],
    variables: [],
    title: 'Payout batch updated',
    body: 'Your payout batch needs follow-up. Check the payout screen for details.',
  },
];

export const NOTIFICATION_TEMPLATE_ROUTES: readonly NotificationTemplateRoute[] = [
  route('booking.opened', Role.CUSTOMER, 'booking.opened'),
  route('booking.requested', Role.PROVIDER, 'booking.requested'),
  route('booking.backup_available', Role.PROVIDER, 'booking.backup_available'),
  route('provider.joined', Role.CUSTOMER, 'provider.joined', ['partnerName']),
  route('booking.matched', Role.CUSTOMER, 'booking.matched'),
  route('booking.matched', Role.PROVIDER, 'booking.matched.partner'),
  route('booking.rejected', Role.CUSTOMER, 'booking.rejected'),
  route('provider.accepted', Role.CUSTOMER, 'provider.accepted', ['partnerName']),
  route('provider.rejected', Role.CUSTOMER, 'provider.rejected', ['partnerName']),
  route('service.started', Role.CUSTOMER, 'service.started'),
  route('service.started', Role.PROVIDER, 'service.started.partner'),
  route('service.completed', Role.CUSTOMER, 'service.completed'),
  route('earning.created', Role.PROVIDER, 'earning.created'),
  route('payment.updated', Role.CUSTOMER, 'payment.updated'),
  route('chat.message.created', Role.CUSTOMER, 'chat.message'),
  route('chat.message.created', Role.PROVIDER, 'chat.message.partner'),
  route('booking.cancelled', Role.CUSTOMER, 'booking.cancelled'),
  route('booking.cancelled', Role.PROVIDER, 'booking.cancelled.partner'),
  route('booking.no_show', Role.CUSTOMER, 'booking.no_show'),
  route('booking.no_show', Role.PROVIDER, 'booking.no_show.partner'),
  route('provider.account.blocked', Role.PROVIDER, 'provider.account.blocked'),
  route('provider.account.unblocked', Role.PROVIDER, 'provider.account.unblocked'),
  route('provider.payout_setup_required', Role.PROVIDER, 'provider.payout_setup_required'),
  route('provider.payout_batch.updated', Role.PROVIDER, 'provider.payout_batch.updated'),
];

const NOTIFICATION_TEMPLATE_OPEN_BEHAVIORS: Readonly<Record<string, NotificationTemplateOpenBehavior>> = {
  'booking.opened': opens('Booking details', ['Booking details'], ['bookingId']),
  'booking.requested': opens('Booking requests', ['Booking requests'], ['bookingId']),
  'booking.backup_available': opens('Booking requests', ['Booking requests'], ['bookingId']),
  'provider.joined': opens('Booking details', ['Booking details'], ['bookingId']),
  'booking.matched': opens(
    'Varies by payload · Chat or booking details',
    ['Chat', 'Booking details'],
    ['bookingId', 'chatRoomId'],
    true,
  ),
  'booking.matched.partner': opens('Active jobs', ['Active jobs'], ['bookingId', 'destination']),
  'booking.rejected': opens('Booking details', ['Booking details'], ['bookingId']),
  'provider.accepted': opens('Booking details', ['Booking details'], ['bookingId']),
  'provider.rejected': opens('Booking details', ['Booking details'], ['bookingId']),
  'service.started': opens(
    'Varies by payload · Chat or booking details',
    ['Chat', 'Booking details'],
    ['bookingId', 'chatRoomId'],
    true,
  ),
  'service.started.partner': opens(
    'Varies by payload · Chat or active jobs',
    ['Chat', 'Active jobs'],
    ['bookingId', 'chatRoomId', 'destination'],
    true,
  ),
  'service.completed': opens('Booking details', ['Booking details'], ['bookingId']),
  'earning.created': opens('Earnings', ['Earnings'], ['earningId', 'bookingId']),
  'payment.updated': opens('Payment', ['Payment'], ['paymentId', 'bookingId']),
  'chat.message': opens('Matched chat', ['Chat'], ['bookingId', 'chatRoomId']),
  'chat.message.partner': opens('Matched chat', ['Chat'], ['bookingId', 'chatRoomId']),
  'booking.cancelled': opens('Booking details', ['Booking details'], ['bookingId']),
  'booking.cancelled.partner': opens('Booking requests', ['Booking requests'], ['bookingId']),
  'booking.no_show': opens('Booking details', ['Booking details'], ['bookingId']),
  'booking.no_show.partner': opens('Booking requests', ['Booking requests'], ['bookingId']),
  'provider.account.blocked': opens(
    'Varies by payload · Partner profile or notification center',
    ['Partner profile', 'Notification center'],
    ['providerProfileId'],
    true,
  ),
  'provider.account.unblocked': opens(
    'Varies by payload · Partner profile or notification center',
    ['Partner profile', 'Notification center'],
    ['providerProfileId'],
    true,
  ),
  'provider.payout_setup_required': opens('Booking requests', ['Booking requests'], ['bookingId']),
  'provider.payout_batch.updated': opens('Earnings', ['Earnings'], ['payoutBatchId']),
};

export function notificationTemplateOpenBehavior(templateKey: string) {
  return NOTIFICATION_TEMPLATE_OPEN_BEHAVIORS[templateKey] ?? opens(
    'No deep link',
    ['Notification center'],
    [],
  );
}

export function resolveNotificationTemplateKey(input: {
  readonly type: string;
  readonly targetRole?: Extract<Role, 'CUSTOMER' | 'PROVIDER'>;
  readonly templateKey?: string;
}) {
  const routeMatch = input.targetRole
    ? NOTIFICATION_TEMPLATE_ROUTES.find(
        (candidate) => candidate.type === input.type && candidate.targetRole === input.targetRole,
      )
    : undefined;
  if (!routeMatch) {
    if (input.templateKey) {
      throw new Error(`Notification template route is not defined for ${input.type}`);
    }
    return null;
  }

  if (input.templateKey && input.templateKey !== routeMatch.templateKey) {
    throw new Error(`Notification template key does not match ${input.type}/${input.targetRole}`);
  }
  const definition = DEFAULT_NOTIFICATION_TEMPLATES.find(
    (candidate) => candidate.key === routeMatch.templateKey,
  );
  if (!definition || definition.audience !== routeMatch.targetRole) {
    throw new Error(`Notification template audience does not match ${routeMatch.templateKey}`);
  }
  return routeMatch.templateKey;
}

export function notificationTemplateContractErrors() {
  const errors: string[] = [];
  const catalogKeys = new Set<string>();
  for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
    if (catalogKeys.has(template.key)) errors.push(`Duplicate catalog key: ${template.key}`);
    catalogKeys.add(template.key);
    const placeholders = notificationTemplatePlaceholders(`${template.title} ${template.body}`);
    const variables = new Set(template.variables);
    const requiredVariables = new Set(template.requiredVariables);
    for (const placeholder of placeholders) {
      if (!variables.has(placeholder)) errors.push(`${template.key} does not declare ${placeholder}`);
    }
    for (const variable of variables) {
      if (!placeholders.has(variable)) errors.push(`${template.key} declares unused ${variable}`);
    }
    for (const variable of requiredVariables) {
      if (!variables.has(variable)) errors.push(`${template.key} requires undeclared ${variable}`);
    }
  }

  const routeKeys = new Set<string>();
  const reachableKeys = new Set<string>();
  for (const candidate of NOTIFICATION_TEMPLATE_ROUTES) {
    const routeKey = `${candidate.type}:${candidate.targetRole}`;
    if (routeKeys.has(routeKey)) errors.push(`Duplicate runtime route: ${routeKey}`);
    routeKeys.add(routeKey);
    reachableKeys.add(candidate.templateKey);
    const definition = DEFAULT_NOTIFICATION_TEMPLATES.find(
      (template) => template.key === candidate.templateKey,
    );
    if (!definition) errors.push(`${routeKey} references missing ${candidate.templateKey}`);
    else if (definition.audience !== candidate.targetRole) {
      errors.push(`${routeKey} audience does not match ${candidate.templateKey}`);
    }
    for (const variable of definition?.requiredVariables ?? []) {
      if (!candidate.payloadVariables.includes(variable)) {
        errors.push(`${routeKey} payload does not provide ${variable}`);
      }
    }
  }
  for (const key of catalogKeys) {
    if (!reachableKeys.has(key)) errors.push(`Catalog key has no runtime route: ${key}`);
    if (!NOTIFICATION_TEMPLATE_OPEN_BEHAVIORS[key]) {
      errors.push(`${key} has no open-intent contract`);
    }
  }
  for (const key of Object.keys(NOTIFICATION_TEMPLATE_OPEN_BEHAVIORS)) {
    if (!catalogKeys.has(key)) errors.push(`Open-intent contract references missing ${key}`);
  }
  return errors;
}

export function isNotificationTemplateLocale(value: string): value is NotificationTemplateLocale {
  return (NOTIFICATION_TEMPLATE_LOCALES as readonly string[]).includes(value);
}

function route(
  type: string,
  targetRole: Extract<Role, 'CUSTOMER' | 'PROVIDER'>,
  templateKey: string,
  payloadVariables: readonly string[] = [],
): NotificationTemplateRoute {
  return { payloadVariables, targetRole, templateKey, type };
}

function opens(
  summary: string,
  possibleDestinations: readonly string[],
  payloadKeys: readonly string[],
  variesByPayload = false,
): NotificationTemplateOpenBehavior {
  return { payloadKeys, possibleDestinations, summary, variesByPayload };
}

function notificationTemplatePlaceholders(value: string) {
  return new Set(Array.from(value.matchAll(/\{([^{}]+)\}/g), (match) => match[1].trim()));
}
