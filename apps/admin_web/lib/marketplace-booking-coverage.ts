export type MarketplaceBookingCoverageTone =
  | 'pill-danger'
  | 'pill-info'
  | 'pill-neutral'
  | 'pill-success'
  | 'pill-warn';

export type MarketplaceBookingCoverageSummaryRow = {
  readonly participantCount: number;
  readonly selectableCount: number;
  readonly selectedPartnerPresent: boolean;
  readonly chatRepairNeeded: boolean;
};

export type MarketplaceBookingCoverageSummary = ReturnType<typeof buildMarketplaceBookingCoverageSummary>;

export type MarketplaceBookingCoveragePill = {
  readonly label: string;
  readonly tone: MarketplaceBookingCoverageTone;
};

export type MarketplaceBookingCoverageRowInput<TBooking> = {
  readonly booking: TBooking;
  readonly chatRepairNeeded: boolean;
  readonly firstPickLabel: string;
  readonly firstPickTone: MarketplaceBookingCoverageTone;
  readonly marketplaceParticipantCount: number;
  readonly nextActionLabel: string;
  readonly nextActionTone: MarketplaceBookingCoverageTone;
  readonly participantCount: number;
  readonly selectableCount: number;
  readonly selectedPartnerLabel: string | null;
  readonly sortTimestamp: number;
  readonly status: string;
  readonly traceBatchCount: number;
  readonly traceLastAge: string | null;
  readonly traceLastStage: string | null;
  readonly traceTotalNotified: number;
  readonly walletLabel: string;
  readonly walletTone: MarketplaceBookingCoverageTone;
};

export type MarketplaceBookingCoverageRow<TBooking> = {
  readonly booking: TBooking;
  readonly firstPickLabel: string;
  readonly firstPickTone: MarketplaceBookingCoverageTone;
  readonly participantCount: number;
  readonly marketplaceParticipantCount: number;
  readonly selectableCount: number;
  readonly selectedPartnerLabel: string;
  readonly selectedPartnerTone: MarketplaceBookingCoverageTone;
  readonly alertLabel: string;
  readonly alertTone: MarketplaceBookingCoverageTone;
  readonly alertDetail: string;
  readonly walletLabel: string;
  readonly walletTone: MarketplaceBookingCoverageTone;
  readonly selectedPartnerPresent: boolean;
  readonly chatRepairNeeded: boolean;
  readonly nextAction: string;
  readonly nextActionTone: MarketplaceBookingCoverageTone;
};

export function buildMarketplaceBookingCoverageSummary(rows: readonly MarketplaceBookingCoverageSummaryRow[]) {
  return {
    total: rows.length,
    withParticipants: rows.filter((row) => row.participantCount > 0).length,
    withoutParticipants: rows.filter((row) => row.participantCount === 0).length,
    selected: rows.filter((row) => row.selectedPartnerPresent).length,
    waitingChoice: rows.filter((row) => row.selectableCount > 0 && !row.selectedPartnerPresent).length,
    chatRepair: rows.filter((row) => row.chatRepairNeeded).length,
  };
}

export function buildMarketplaceBookingCoveragePills(
  summary: MarketplaceBookingCoverageSummary,
): readonly MarketplaceBookingCoveragePill[] {
  return [
    {
      label: `Bookings with participant history ${summary.withParticipants}`,
      tone: 'pill-info',
    },
    {
      label: `Bookings without participants ${summary.withoutParticipants}`,
      tone: summary.withoutParticipants > 0 ? 'pill-warn' : 'pill-success',
    },
    {
      label: `Waiting customer choice ${summary.waitingChoice}`,
      tone: summary.waitingChoice > 0 ? 'pill-warn' : 'pill-neutral',
    },
    {
      label: `Chat handoff repair ${summary.chatRepair}`,
      tone: summary.chatRepair > 0 ? 'pill-danger' : 'pill-success',
    },
  ];
}

export function buildMarketplaceBookingCoverageRows<TBooking>(
  inputs: readonly MarketplaceBookingCoverageRowInput<TBooking>[],
): readonly MarketplaceBookingCoverageRow<TBooking>[] {
  return inputs
    .map(toCoverageRow)
    .sort((left, right) => coveragePriority(left) - coveragePriority(right) || right.sortTimestamp - left.sortTimestamp)
    .map((row) => ({
      alertDetail: row.alertDetail,
      alertLabel: row.alertLabel,
      alertTone: row.alertTone,
      booking: row.booking,
      chatRepairNeeded: row.chatRepairNeeded,
      firstPickLabel: row.firstPickLabel,
      firstPickTone: row.firstPickTone,
      marketplaceParticipantCount: row.marketplaceParticipantCount,
      nextAction: row.nextAction,
      nextActionTone: row.nextActionTone,
      participantCount: row.participantCount,
      selectableCount: row.selectableCount,
      selectedPartnerLabel: row.selectedPartnerLabel,
      selectedPartnerPresent: row.selectedPartnerPresent,
      selectedPartnerTone: row.selectedPartnerTone,
      walletLabel: row.walletLabel,
      walletTone: row.walletTone,
    }));
}

type SortableMarketplaceBookingCoverageRow<TBooking> = MarketplaceBookingCoverageRow<TBooking> & {
  readonly sortTimestamp: number;
};

function toCoverageRow<TBooking>(
  input: MarketplaceBookingCoverageRowInput<TBooking>,
): SortableMarketplaceBookingCoverageRow<TBooking> {
  const selectedPartnerPresent = input.selectedPartnerLabel !== null;
  const alert = alertState(input);
  const selectedPartner = selectedPartnerState(input);

  return {
    alertDetail: alert.detail,
    alertLabel: alert.label,
    alertTone: alert.tone,
    booking: input.booking,
    chatRepairNeeded: input.chatRepairNeeded,
    firstPickLabel: input.firstPickLabel,
    firstPickTone: input.firstPickTone,
    marketplaceParticipantCount: input.marketplaceParticipantCount,
    nextAction: input.nextActionLabel,
    nextActionTone: input.nextActionTone,
    participantCount: input.participantCount,
    selectableCount: input.selectableCount,
    selectedPartnerLabel: selectedPartner.label,
    selectedPartnerPresent,
    selectedPartnerTone: selectedPartner.tone,
    sortTimestamp: input.sortTimestamp,
    walletLabel: input.walletLabel,
    walletTone: input.walletTone,
  };
}

function selectedPartnerState<TBooking>(input: MarketplaceBookingCoverageRowInput<TBooking>) {
  if (input.selectedPartnerLabel !== null) {
    return { label: input.selectedPartnerLabel, tone: 'pill-success' } as const;
  }
  if (input.selectableCount > 0) {
    return { label: 'Awaiting customer choice', tone: 'pill-warn' } as const;
  }
  return { label: 'No final Partner', tone: 'pill-neutral' } as const;
}

function alertState<TBooking>(input: MarketplaceBookingCoverageRowInput<TBooking>) {
  if (input.traceBatchCount === 0) {
    return {
      detail: 'Marketplace notification delivery is not recorded for this booking.',
      label: input.status === 'OPEN_MATCHING' ? 'No alert batch' : 'No alert record',
      tone: input.status === 'OPEN_MATCHING' ? 'pill-danger' : 'pill-neutral',
    } as const;
  }

  return {
    detail: `${input.traceBatchCount} batch(es), latest ${input.traceLastStage ?? 'stage not saved'}${
      input.traceLastAge ? ` / ${input.traceLastAge}` : ''
    }`,
    label: `${input.traceTotalNotified} notified`,
    tone: input.traceTotalNotified > 0 ? 'pill-success' : 'pill-warn',
  } as const;
}

function coveragePriority(row: MarketplaceBookingCoverageRow<unknown>) {
  if (row.nextActionTone === 'pill-danger') {
    return 0;
  }
  if (row.nextActionTone === 'pill-warn') {
    return 1;
  }
  if (row.selectedPartnerTone === 'pill-warn') {
    return 2;
  }
  return 3;
}
