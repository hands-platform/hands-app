export type BackupAlertTraceDisplayInput = {
  readonly batchCount: number;
  readonly bookingStatus: string;
  readonly lastAge: string | null;
  readonly totalNotified: number;
};

export type BackupAlertTraceDisplay = {
  readonly label: string;
  readonly pill: string;
  readonly tone: 'pill-success' | 'pill-warn' | 'pill-danger' | 'pill-neutral';
};

export function backupAlertTraceDisplayFromSummary(
  input: BackupAlertTraceDisplayInput,
): BackupAlertTraceDisplay {
  return {
    label: backupAlertTraceLabel(input),
    pill: backupAlertTracePill(input),
    tone: backupAlertTraceTone(input),
  };
}

function backupAlertTraceLabel(input: BackupAlertTraceDisplayInput) {
  if (!input.batchCount) {
    return 'Marketplace alerts: no batch recorded';
  }
  if (input.totalNotified > 0) {
    return `Marketplace alerts: ${input.totalNotified} notified / ${input.batchCount} batch(es)${
      input.lastAge ? ` / last ${input.lastAge}` : ''
    }`;
  }
  return `Marketplace alerts: ${input.batchCount} batch(es), no eligible partner notified`;
}

function backupAlertTracePill(input: BackupAlertTraceDisplayInput) {
  if (!input.batchCount) {
    return 'No marketplace trace';
  }
  if (input.totalNotified > 0) {
    return `${input.totalNotified} marketplace alert(s)`;
  }
  return 'Marketplace trace empty';
}

function backupAlertTraceTone(input: BackupAlertTraceDisplayInput): BackupAlertTraceDisplay['tone'] {
  if (input.totalNotified > 0) {
    return 'pill-success';
  }
  if (input.batchCount > 0) {
    return 'pill-warn';
  }
  if (input.bookingStatus === 'OPEN_MATCHING') {
    return 'pill-danger';
  }
  return 'pill-neutral';
}
