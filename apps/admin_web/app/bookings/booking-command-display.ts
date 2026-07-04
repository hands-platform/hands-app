export type BookingCommandTone = 'ok' | 'info' | 'warn' | 'danger';
export type BookingActionPriority = 'P0' | 'P1' | 'P2' | 'P3';

export function stagePillClass(tone: BookingCommandTone) {
  if (tone === 'danger') {
    return 'pill-danger';
  }
  if (tone === 'warn') {
    return 'pill-warn';
  }
  if (tone === 'ok') {
    return 'pill-success';
  }
  return 'pill-info';
}

export function commandToneClass(tone: BookingCommandTone) {
  if (tone === 'danger') {
    return 'signal-warn';
  }
  if (tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}

export function commandSignalTone(tone: BookingCommandTone) {
  if (tone === 'danger' || tone === 'warn') {
    return 'warn';
  }
  if (tone === 'info') {
    return 'info';
  }
  return 'ok';
}

export function bookingDashboardTone(tone: BookingCommandTone) {
  if (tone === 'danger') {
    return 'danger';
  }
  if (tone === 'warn') {
    return 'warn';
  }
  if (tone === 'info') {
    return 'info';
  }
  return 'ok';
}

export function actionOrderLabel(priority: BookingActionPriority) {
  if (priority === 'P0') {
    return 'Same-shift';
  }
  if (priority === 'P1') {
    return 'Active watch';
  }
  if (priority === 'P2') {
    return 'Follow-up';
  }
  return 'Routine';
}

export function commandToneLabel(tone: BookingCommandTone) {
  if (tone === 'danger') {
    return 'Immediate check';
  }
  if (tone === 'warn') {
    return 'Monitor';
  }
  if (tone === 'info') {
    return 'Info';
  }
  return 'Clear';
}

export function commandToneWeight(tone: BookingCommandTone) {
  if (tone === 'danger') {
    return 4;
  }
  if (tone === 'warn') {
    return 3;
  }
  if (tone === 'info') {
    return 2;
  }
  return 1;
}
