import { readFileSync } from 'node:fs';

describe('Booking payment actions', () => {
  it('uses shared Vuexy badge atoms instead of raw payment action pill spans', () => {
    const source = readFileSync('app/bookings/[id]/booking-payment-actions.tsx', 'utf8');

    expect(source).toContain('PillClassBadge');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain(
      "<span className={`pill ${readout?.pillClass ?? (disabled ? 'pill-neutral' : 'pill-info')}`}>",
    );
    expect(source).not.toContain('<span className="pill pill-danger">Settlement needed</span>');
  });
});
