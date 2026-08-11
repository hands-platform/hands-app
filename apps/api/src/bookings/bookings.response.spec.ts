import {
  clientBookingPayment,
  clientBookingResponse,
  partnerBookingResponse,
  partnerOpenBookingResponse,
} from './bookings.response';

describe('client booking response helpers', () => {
  it('keeps only client-safe payment fields', () => {
    const payment = clientBookingPayment({
      id: 'payment-1',
      bookingId: 'booking-1',
      method: 'CASH',
      status: 'AUTHORIZED',
      amount: 450000,
      currency: 'VND',
      providerRef: 'internal-provider-ref',
      rawMeta: { gatewaySecret: 'hidden' },
    });

    expect(payment).toEqual({
      amount: 450000,
      method: 'CASH',
      status: 'AUTHORIZED',
      currency: 'VND',
    });
    expect(JSON.stringify(payment)).not.toContain('payment-1');
    expect(JSON.stringify(payment)).not.toContain('booking-1');
    expect(JSON.stringify(payment)).not.toContain('internal-provider-ref');
    expect(JSON.stringify(payment)).not.toContain('gatewaySecret');
  });

  it('removes internal booking notes, metadata, and private partner fields from customer responses', () => {
    const response = clientBookingResponse({
      id: 'booking-1',
      status: 'CANCELLED',
      selectedProviderId: null,
      notes: 'internal booking note',
      closedNote: 'operator-only cancellation analysis',
      metadata: { adminDecision: 'hidden' },
      customerProfile: { userId: 'customer-user-secret' },
      preferredProvider: {
        id: 'partner-1',
        displayName: 'Linh Wellness',
        ratingAvg: 4.9,
        reviewCount: 12,
        legalName: 'Private Legal Name',
        userId: 'partner-user-secret',
        currentLat: 10.7769,
        currentLng: 106.7009,
        blockedReason: 'internal review',
      },
      participants: [
        {
          id: 'participant-1',
          status: 'REJECTED',
          providerProfile: {
            id: 'partner-1',
            displayName: 'Linh Wellness',
            residentialAddress: 'Private home address',
          },
        },
      ],
      payment: null,
      snapshots: [{ latitude: 10.7769, longitude: 106.7009 }],
    });
    const serialized = JSON.stringify(response);

    expect(response).not.toHaveProperty('notes');
    expect(response).not.toHaveProperty('closedNote');
    expect(response).not.toHaveProperty('metadata');
    expect(response).not.toHaveProperty('customerProfile');
    expect(serialized).not.toContain('Private Legal Name');
    expect(serialized).not.toContain('partner-user-secret');
    expect(serialized).not.toContain('Private home address');
    expect(serialized).not.toContain('10.7769');
    expect(response.preferredProvider).toEqual(
      expect.objectContaining({ id: 'partner-1', displayName: 'Linh Wellness' }),
    );
  });

  it('returns a safe cancellation reason and payment outcome without internal evidence', () => {
    const response = clientBookingResponse({
      id: 'booking-1',
      status: 'CANCELLED',
      closedReason: 'provider_post_match_cancellation',
      closedNote: 'Operator-only note',
      metadata: {
        postMatchCancellation: {
          reasonCode: 'CUSTOMER_NOT_FOUND',
          reasonDetail: 'Private partner narrative',
          location: { latitude: 10.7769, longitude: 106.7009 },
          requiresAdminReview: true,
        },
      },
      payment: {
        amount: 500000,
        method: 'CUSTOMER_WALLET',
        status: 'CAPTURED',
      },
      refunds: [{ status: 'PENDING', providerRef: 'private-refund-reference' }],
    });
    const serialized = JSON.stringify(response);

    expect(response.cancellation).toEqual({
      reasonCode: 'CUSTOMER_NOT_FOUND',
      reason: 'The partner could not meet you at the service location.',
      paymentOutcome: 'UNDER_REVIEW',
      supportRecommended: true,
    });
    expect(serialized).not.toContain('Private partner narrative');
    expect(serialized).not.toContain('10.7769');
    expect(serialized).not.toContain('private-refund-reference');
    expect(response).not.toHaveProperty('closedReason');
    expect(response).not.toHaveProperty('metadata');
    expect(response).not.toHaveProperty('refunds');
  });

  it('distinguishes marketplace expiry from a preferred partner no-response', () => {
    expect(
      clientBookingResponse({
        id: 'marketplace-booking',
        status: 'EXPIRED',
        closedReason: 'matching_request_expired',
      }).cancellation,
    ).toEqual(
      expect.objectContaining({
        reasonCode: 'REQUEST_EXPIRED',
        reason: 'This booking request expired before a partner was matched.',
      }),
    );

    expect(
      clientBookingResponse({
        id: 'preferred-booking',
        status: 'EXPIRED',
        closedReason: 'preferred_provider_no_response',
      }).cancellation,
    ).toEqual(
      expect.objectContaining({
        reasonCode: 'PARTNER_RESPONSE_EXPIRED',
        reason: 'The partner did not respond before the booking request expired.',
      }),
    );
  });

  it('removes customer identity, contact, exact address, and exact coordinates from partner open-booking responses', () => {
    const response = partnerOpenBookingResponse({
      id: 'booking-1',
      customerProfileId: 'customer-1',
      address: {
        name: 'Demo Customer',
        phone: '0865907184',
        phone_number: '0865907184',
        line1: '123 Nguyen Hue Street, District 1, Ho Chi Minh City, Vietnam',
        district: 'District 1',
        city: 'Ho Chi Minh City',
        country: 'Vietnam',
      },
      addressSnapshot: {
        customerProfileId: 'customer-1',
        selectedLocationId: 'location-1',
        address: {
          name: 'Demo Customer',
          phone: '0865907184',
          line1: '123 Nguyen Hue Street, District 1, Ho Chi Minh City, Vietnam',
          district: 'District 1',
          city: 'Ho Chi Minh City',
          country: 'Vietnam',
        },
        addressText: '123 Nguyen Hue Street, District 1, Ho Chi Minh City, Vietnam',
        latitude: '10.7769000',
        longitude: '106.7009000',
      },
      payment: {
        id: 'payment-1',
        method: 'CASH',
        status: 'AUTHORIZED',
        amount: 450000,
      },
      customerProfile: {
        gender: 'FEMALE',
        nationality: 'Vietnamese',
        user: { fullName: 'Demo Customer', phone: '0865907184' },
      },
    });

    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain('Demo Customer');
    expect(serialized).not.toContain('0865907184');
    expect(serialized).not.toContain('123 Nguyen Hue');
    expect(serialized).not.toContain('10.7769000');
    expect(serialized).not.toContain('106.7009000');
    expect(serialized).not.toContain('customer-1');
    expect(serialized).not.toContain('secret-customer-user');
    expect(response).not.toHaveProperty('customerProfile');
    expect(response.customer).toEqual({
      gender: 'FEMALE',
      nationality: 'Vietnamese',
    });
    expect(response.address).toEqual({
      district: 'District 1',
      city: 'Ho Chi Minh City',
      country: 'Vietnam',
      addressPreview: 'District 1, Ho Chi Minh City, Vietnam',
    });
    expect(response.addressSnapshot).toEqual({
      address: {
        district: 'District 1',
        city: 'Ho Chi Minh City',
        country: 'Vietnam',
        addressPreview: 'District 1, Ho Chi Minh City, Vietnam',
      },
      addressPreview: 'District 1, Ho Chi Minh City, Vietnam',
    });
  });

  it('marks a first-pick request without exposing the preferred provider user id', () => {
    const response = partnerOpenBookingResponse(
      {
        id: 'booking-1',
        preferredProviderId: 'provider-1',
        preferredProvider: {
          id: 'provider-1',
          userId: 'private-provider-user',
          displayName: 'Mai',
        },
      },
      'provider-1',
    );

    expect(response.isPreferredRequest).toBe(true);
    expect(JSON.stringify(response)).not.toContain('private-provider-user');
  });

  it('returns only the signed-in partner participation status', () => {
    const response = partnerOpenBookingResponse(
      {
        id: 'booking-1',
        participants: [
          { providerProfileId: 'provider-1', status: 'JOINED' },
          { providerProfileId: 'provider-2', status: 'ACCEPTED' },
        ],
      },
      'provider-1',
    );

    expect(response.participationStatus).toBe('JOINED');
  });

  it('only exposes the exact service address to the selected partner booking response', () => {
    const booking = {
      id: 'booking-1',
      selectedProviderId: 'selected-partner',
      customerProfileId: 'customer-1',
      addressSnapshot: {
        address: {
          name: 'Demo Customer',
          phone: '0865907184',
          line1: '123 Nguyen Hue Street, District 1, Ho Chi Minh City, Vietnam',
          district: 'District 1',
          city: 'Ho Chi Minh City',
          country: 'Vietnam',
        },
        addressText: '123 Nguyen Hue Street, District 1, Ho Chi Minh City, Vietnam',
        latitude: '10.7769000',
        longitude: '106.7009000',
      },
      customerProfile: {
        gender: 'FEMALE',
        nationality: 'Vietnamese',
        user: { fullName: 'Demo Customer', phone: '0865907184' },
      },
      payment: {
        method: 'CASH',
        status: 'AUTHORIZED',
        amount: 450000,
      },
    };

    const selectedResponse = partnerBookingResponse(booking, 'selected-partner');
    const marketplaceResponse = partnerBookingResponse(booking, 'marketplace-partner');

    expect(JSON.stringify(selectedResponse)).toContain('123 Nguyen Hue');
    expect(JSON.stringify(selectedResponse)).toContain('10.7769000');
    expect(JSON.stringify(selectedResponse)).not.toContain('customer-1');
    expect(selectedResponse).not.toHaveProperty('customerProfile');
    expect(selectedResponse.customer).toEqual({
      gender: 'FEMALE',
      nationality: 'Vietnamese',
      fullName: 'Demo Customer',
      phone: '0865907184',
    });

    const serializedMarketplaceResponse = JSON.stringify(marketplaceResponse);
    expect(serializedMarketplaceResponse).not.toContain('123 Nguyen Hue');
    expect(serializedMarketplaceResponse).not.toContain('10.7769000');
    expect(serializedMarketplaceResponse).not.toContain('Demo Customer');
    expect(serializedMarketplaceResponse).not.toContain('0865907184');
    expect(marketplaceResponse.customer).toEqual({
      gender: 'FEMALE',
      nationality: 'Vietnamese',
    });
  });
});
