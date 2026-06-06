import { clientBookingPayment, partnerOpenBookingResponse } from './bookings.response';

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

  it('removes customer contact, exact address, and exact coordinates from partner open-booking responses', () => {
    const response = partnerOpenBookingResponse({
      id: 'booking-1',
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
    });

    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain('0865907184');
    expect(serialized).not.toContain('123 Nguyen Hue');
    expect(serialized).not.toContain('10.7769000');
    expect(serialized).not.toContain('106.7009000');
    expect(response.address).toEqual({
      name: 'Demo Customer',
      district: 'District 1',
      city: 'Ho Chi Minh City',
      country: 'Vietnam',
      addressPreview: 'District 1, Ho Chi Minh City, Vietnam',
    });
    expect(response.addressSnapshot).toEqual({
      address: {
        name: 'Demo Customer',
        district: 'District 1',
        city: 'Ho Chi Minh City',
        country: 'Vietnam',
        addressPreview: 'District 1, Ho Chi Minh City, Vietnam',
      },
      addressPreview: 'District 1, Ho Chi Minh City, Vietnam',
    });
  });
});
