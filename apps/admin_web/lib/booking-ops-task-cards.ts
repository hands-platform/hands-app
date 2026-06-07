export type BookingOpsTaskInput = {
  type: string;
  status: string;
  note?: string | null;
  updatedAt: string;
  actor?: {
    fullName?: string | null;
    phone?: string | null;
  } | null;
};

export type BookingOpsTaskCard = {
  type: string;
  label: string;
  helper: string;
  status: string;
  note: string | null;
  updatedBy: string;
};

export type BookingOpsTaskCardOptions = {
  formatDate: (value?: string | null) => string;
};

const bookingOpsTaskDefinitions = [
  {
    type: 'CUSTOMER_CONTACTED',
    label: 'Customer contacted',
    helper:
      'Confirm the guest has been updated when waiting, switching partner, cancelling, or resolving payment.',
  },
  {
    type: 'PROVIDER_CONTACTED',
    label: 'Partner contacted',
    helper: 'Confirm the partner has been reached for response, location, arrival, or service progress.',
  },
  {
    type: 'LOCATION_CHECKED',
    label: 'Location checked',
    helper: 'Confirm saved customer/partner pins are reasonable. No route or continuous tracking is used.',
  },
  {
    type: 'PAYMENT_REVIEWED',
    label: 'Payment reviewed',
    helper: 'Confirm authorization, capture, release, cash fallback, or refund path before closing.',
  },
] as const;

export function bookingOpsTaskCards(
  tasks: BookingOpsTaskInput[] | null | undefined,
  options: BookingOpsTaskCardOptions,
): BookingOpsTaskCard[] {
  const taskByType = new Map((tasks ?? []).map((task) => [task.type, task]));

  return bookingOpsTaskDefinitions.map((definition) => {
    const task = taskByType.get(definition.type);
    return {
      ...definition,
      status: task?.status ?? 'PENDING',
      note: task?.note?.trim() ? task.note.trim() : null,
      updatedBy: task
        ? `Updated ${options.formatDate(task.updatedAt)} by ${task.actor?.fullName ?? task.actor?.phone ?? 'Admin'}`
        : 'Not checked yet',
    };
  });
}
