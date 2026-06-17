import {
  primaryBookingOpsInstruction,
  type PrimaryBookingOpsInstructionInput,
} from './booking-primary-ops-instruction';

describe('primary booking ops instruction', () => {
  it('asks operators to confirm customer communication when expired payment is released', () => {
    const booking: PrimaryBookingOpsInstructionInput = {
      status: 'EXPIRED',
      payment: { status: 'RELEASED' },
    };

    expect(primaryBookingOpsInstruction(booking)).toBe(
      'Matching expired and the payment hold is released. Confirm customer communication before closing.',
    );
  });

  it('keeps no-show as a chat and payment evidence review', () => {
    const booking: PrimaryBookingOpsInstructionInput = {
      status: 'NO_SHOW',
      payment: { status: 'AUTHORIZED' },
    };

    expect(primaryBookingOpsInstruction(booking)).toBe(
      'Booking is marked no-show. Review customer communication, payment release/refund, and any Partner fee impact before closing.',
    );
  });

  it('prioritizes completed authorized payment capture before wallet debt copy', () => {
    const booking: PrimaryBookingOpsInstructionInput = {
      status: 'COMPLETED',
      payment: { status: 'AUTHORIZED' },
    };

    expect(primaryBookingOpsInstruction(booking, { cashDebtNeedsSettlement: true })).toBe(
      'Service is complete. Capture the authorized payment or refund if there was a dispute.',
    );
  });

  it('explains cash fee debt blocks marketplace alerts, participation, and payout release', () => {
    const booking: PrimaryBookingOpsInstructionInput = {
      status: 'MATCHED',
      payment: { status: 'CAPTURED' },
    };

    expect(primaryBookingOpsInstruction(booking, { cashDebtNeedsSettlement: true })).toBe(
      'Partner collected cash. Finance must settle the HANDS fee debt before this Partner participates in marketplace bookings again or receives payout release.',
    );
  });

  it('points open matching bookings to Partner response and marketplace supply', () => {
    const booking: PrimaryBookingOpsInstructionInput = {
      status: 'OPEN_MATCHING',
    };

    expect(primaryBookingOpsInstruction(booking)).toBe(
      'Monitor Partner response speed and marketplace supply. Customer is still waiting.',
    );
  });

  it('keeps in-service chat visible until completion when a room exists', () => {
    const booking: PrimaryBookingOpsInstructionInput = {
      status: 'IN_SERVICE',
      chatRoom: { id: 'room-1' },
    };

    expect(primaryBookingOpsInstruction(booking)).toBe(
      'Service is live. Keep chat and location visible until completion.',
    );
  });
});
