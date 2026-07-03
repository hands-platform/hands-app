import {
  partnerOpsCardClass,
  partnerOpsPillClass,
  partnerOpsStatusBadgeTone,
  partnerOpsStepLabel,
} from './partner-detail-tone';

describe('partner detail tone helpers', () => {
  it('maps partner operations tones to shared status badge tones', () => {
    expect(partnerOpsStatusBadgeTone('done')).toBe('success');
    expect(partnerOpsStatusBadgeTone('pending')).toBe('warning');
    expect(partnerOpsStatusBadgeTone('blocked')).toBe('danger');
  });

  it('maps partner operations tones to Vuexy pill classes and card classes', () => {
    expect(partnerOpsPillClass('done')).toBe('pill-success');
    expect(partnerOpsPillClass('pending')).toBe('pill-warn');
    expect(partnerOpsPillClass('blocked')).toBe('pill-danger');

    expect(partnerOpsCardClass('done')).toBe('ops-task-done');
    expect(partnerOpsCardClass('pending')).toBe('ops-task-pending');
    expect(partnerOpsCardClass('blocked')).toBe('ops-task-blocked');
  });

  it('keeps partner operations tone labels consistent across detail sections', () => {
    expect(partnerOpsStepLabel('done')).toBe('Clear');
    expect(partnerOpsStepLabel('pending')).toBe('Operator check');
    expect(partnerOpsStepLabel('blocked')).toBe('Blocks booking');
  });
});
