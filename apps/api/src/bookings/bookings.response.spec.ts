import { clientBookingPayment, partnerBookingResponse, partnerOpenBookingResponse } from './bookings.response';

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
        id: 'customer-1',
        userId: 'secret-customer-user',
        phone: '0865907184',
        displayName: 'Demo Customer',
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
        id: 'customer-1',
        userId: 'secret-customer-user',
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
    expect(JSON.stringify(selectedResponse)).not.toContain('secret-customer-user');
    expect(selectedResponse).not.toHaveProperty('customerProfile');

    const serializedMarketplaceResponse = JSON.stringify(marketplaceResponse);
    expect(serializedMarketplaceResponse).not.toContain('123 Nguyen Hue');
    expect(serializedMarketplaceResponse).not.toContain('10.7769000');
    expect(serializedMarketplaceResponse).not.toContain('Demo Customer');
    expect(serializedMarketplaceResponse).not.toContain('0865907184');
  });
});
