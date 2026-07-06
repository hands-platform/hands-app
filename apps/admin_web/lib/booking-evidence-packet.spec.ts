import { bookingEvidencePacket } from './booking-evidence-packet';

const baseInput = {
  chatReady: false,
  messageCount: 0,
  latestMessageAtLabel: null,
  latestMessageAtValue: null,
  locationTrailCount: 0,
  latestLocationAtLabel: null,
  latestLocationAtValue: null,
  latestLocationCoordinateLabel: null,
  paymentStatus: 'NONE',
  paymentMethod: 'No method',
  paymentAmountLabel: '0 VND',
  refundRows: [],
  alertCount: 0,
  failedAlertCount: 0,
  marketplaceBatchCount: 0,
  operatorNoteLines: [],
  auditLogCount: 0,
  opsTaskCount: 0,
  hasAddressSnapshot: false,
  addressSnapshotLabel: 'No confirmed address',
  addressPinLabel: null,
  chatRoomShortId: null,
  customerPriceLabel: 'No customer price',
  walletLedgerLabel: 'No wallet impact',
  refundEvidence: 'No refund evidence.',
  activityRecordCount: 0,
  latestActivityTitle: null,
  latestActivityAtLabel: null,
  latestActivityAtValue: null,
};

describe('bookingEvidencePacket', () => {
  it('marks packets without retained decision evidence as needing evidence', () => {
    const packet = bookingEvidencePacket(baseInput);

    expect(packet.status).toBe('Needs evidence');
    expect(packet.tone).toBe('pill-warn');
    expect(packet.summary).toBe(
      'No chat, alert, location, or operator note evidence is attached yet; add a note before manual outcome changes.',
    );
  });

  it('counts retained evidence facts without judging the customer or partner', () => {
    const packet = bookingEvidencePacket({
      ...baseInput,
      chatReady: true,
      messageCount: 2,
      locationTrailCount: 1,
      alertCount: 3,
      operatorNoteLines: ['Called partner and customer.'],
      refundRows: [{ status: 'PENDING', amountLabel: '120.000 VND' }],
      auditLogCount: 2,
    });

    expect(packet.status).toBe('Evidence ready');
    expect(packet.tone).toBe('pill-success');
    expect(packet.summary).toBe(
      'Admin can review 10 retained evidence item(s) before changing booking outcome.',
    );
    expect(JSON.stringify(packet)).not.toMatch(
      new RegExp(['risk', `sco${'re'}`, 'rank'].join('|'), 'i'),
    );
  });

  it('builds metric rows for chat, location, payment, refund, alerts, and notes', () => {
    const packet = bookingEvidencePacket({
      ...baseInput,
      chatReady: true,
      messageCount: 4,
      latestLocationAtLabel: '07 Jun 2026 10:30',
      latestLocationCoordinateLabel: 'District 1, Ho Chi Minh City',
      paymentStatus: 'AUTHORIZED',
      paymentMethod: 'MOMO',
      paymentAmountLabel: '450.000 VND',
      refundRows: [
        { status: 'PENDING', amountLabel: '120.000 VND' },
        { status: 'APPROVED', amountLabel: '50.000 VND' },
      ],
      alertCount: 5,
      failedAlertCount: 1,
      marketplaceBatchCount: 2,
      operatorNoteLines: ['Latest operator note.'],
    });

    expect(packet.metrics.map((metric) => metric.label)).toEqual([
      'Chat evidence',
      'Location evidence',
      'Payment evidence',
      'Refund evidence',
      'Alert evidence',
      'Operator note evidence',
    ]);
    expect(packet.metrics[1]).toMatchObject({
      value: '07 Jun 2026 10:30',
      helper: 'District 1, Ho Chi Minh City latest Partner location.',
    });
    expect(packet.metrics[3].helper).toBe('PENDING 120.000 VND, APPROVED 50.000 VND');
  });

  it('builds factual record rows for address, chat, location, payment, refund, alerts, notes, ops, and audit', () => {
    const packet = bookingEvidencePacket({
      ...baseInput,
      hasAddressSnapshot: true,
      addressSnapshotLabel: 'District 1, Ho Chi Minh City',
      addressPinLabel: 'District 1, Ho Chi Minh City',
      chatReady: true,
      chatRoomShortId: 'abc123',
      messageCount: 2,
      latestMessageAtLabel: '07 Jun 2026 10:35',
      latestMessageAtValue: '2026-06-07T03:35:00.000Z',
      latestLocationAtLabel: '07 Jun 2026 10:30',
      latestLocationAtValue: '2026-06-07T03:30:00.000Z',
      latestLocationCoordinateLabel: 'District 1, Ho Chi Minh City',
      customerPriceLabel: '450.000 VND customer price',
      walletLedgerLabel: 'No wallet block',
      refundEvidence: 'No refund row is attached.',
      alertCount: 1,
      operatorNoteLines: ['Latest note'],
      opsTaskCount: 2,
      auditLogCount: 3,
      activityRecordCount: 4,
      latestActivityTitle: 'booking.matched',
      latestActivityAtLabel: '07 Jun 2026 10:40',
      latestActivityAtValue: '2026-06-07T03:40:00.000Z',
    });

    expect(packet.records.map((record) => record.id)).toEqual([
      'address-evidence',
      'chat-evidence',
      'location-evidence',
      'payment-evidence',
      'refund-evidence',
      'alert-evidence',
      'note-evidence',
      'ops-evidence',
      'audit-evidence',
    ]);
    expect(packet.records[0].detail).toBe(
      'Locked address snapshot: District 1, Ho Chi Minh City.',
    );
    expect(packet.records[0].evidence).toBe(
      'Address snapshot District 1, Ho Chi Minh City',
    );
    expect(packet.records[2].detail).toBe(
      'Latest Partner location is District 1, Ho Chi Minh City.',
    );
    expect(packet.metrics[1]).toMatchObject({
      dateTimeValue: '2026-06-07T03:30:00.000Z',
    });
    expect(packet.records[1]).toMatchObject({
      evidence: '07 Jun 2026 10:35',
      evidenceDateTimePrefix: 'Latest message: ',
      evidenceDateTimeValue: '2026-06-07T03:35:00.000Z',
    });
    expect(packet.records[2]).toMatchObject({
      evidence: '07 Jun 2026 10:30',
      evidenceDateTimePrefix: 'Recorded ',
      evidenceDateTimeValue: '2026-06-07T03:30:00.000Z',
    });
    expect(packet.records[8]).toMatchObject({
      evidence: '07 Jun 2026 10:40',
      evidenceDateTimePrefix: 'Latest event: booking.matched / ',
      evidenceDateTimeValue: '2026-06-07T03:40:00.000Z',
    });
    expect(JSON.stringify(packet)).not.toMatch(/\bpin\b/i);
  });

  it('does not echo raw coordinate labels in address or location records', () => {
    const packet = bookingEvidencePacket({
      ...baseInput,
      hasAddressSnapshot: true,
      addressSnapshotLabel: 'District 1, Ho Chi Minh City',
      addressPinLabel: '10.7769, 106.7009',
      latestLocationCoordinateLabel: '10.7769, 106.7009',
      latestLocationAtLabel: '07 Jun 2026 10:30',
    });

    expect(packet.records[0].evidence).toBe('Address snapshot Service address snapshot saved');
    expect(packet.records[2].detail).toBe('Latest Partner location is saved for dispatch checks.');
    expect(JSON.stringify(packet.records)).not.toMatch(/\d{1,3}\.\d{2,},\s*\d{1,3}\.\d{2,}/);
  });
});
