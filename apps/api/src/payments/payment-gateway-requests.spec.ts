import {
  buildMomoCreatePaymentRequest,
  buildMomoConfirmPaymentRequest,
  buildMomoQueryPaymentRequest,
  buildMomoRefundPaymentRequest,
  buildMomoRefundQueryRequest,
  buildVnpayCheckoutRequest,
  buildVnpayQueryPaymentRequest,
  buildVnpayRefundPaymentRequest,
} from './payment-gateway-requests';

describe('payment gateway request builders', () => {
  it('builds the official MoMo captureWallet request shape and HMAC-SHA256 signature', () => {
    expect(
      buildMomoCreatePaymentRequest({
        accessKey: 'access-key',
        amountVnd: 120000,
        ipnUrl: 'https://api.hands.vn/api/payments/MOMO/callback',
        orderId: 'booking-1',
        orderInfo: 'HANDS booking booking-1',
        partnerCode: 'partner-code',
        redirectUrl: 'https://hands.vn/payments/return',
        requestId: 'payment-1',
        secretKey: 'secret-key',
      }),
    ).toEqual({
      endpoint: 'https://test-payment.momo.vn/v2/gateway/api/create',
      body: {
        amount: 120000,
        autoCapture: true,
        extraData: '',
        ipnUrl: 'https://api.hands.vn/api/payments/MOMO/callback',
        lang: 'vi',
        orderId: 'booking-1',
        orderInfo: 'HANDS booking booking-1',
        partnerCode: 'partner-code',
        redirectUrl: 'https://hands.vn/payments/return',
        requestId: 'payment-1',
        requestType: 'captureWallet',
        signature: '59f41ac8051aefa5f261466c57edec133ded4873d597582a0259ef7dcc0eafde',
      },
    });
  });

  it('enforces the documented MoMo amount and merchant reference constraints', () => {
    const valid = {
      accessKey: 'access-key',
      amountVnd: 120000,
      ipnUrl: 'https://api.hands.vn/api/payments/MOMO/callback',
      orderId: 'booking-1',
      orderInfo: 'HANDS booking booking-1',
      partnerCode: 'partner-code',
      redirectUrl: 'https://hands.vn/payments/return',
      requestId: 'payment-1',
      secretKey: 'secret-key',
    };

    expect(() => buildMomoCreatePaymentRequest({ ...valid, amountVnd: 999 })).toThrow(
      'MoMo amount must be an integer between 1000 and 50000000 VND',
    );
    expect(() => buildMomoCreatePaymentRequest({ ...valid, orderId: 'customer phone 0900000000' })).toThrow(
      'MoMo orderId is invalid',
    );
    expect(() => buildMomoCreatePaymentRequest({ ...valid, baseUrl: 'http://test-payment.momo.vn' })).toThrow(
      'MoMo baseUrl must use HTTPS',
    );
  });

  it('builds the official MoMo transaction query signature', () => {
    expect(
      buildMomoQueryPaymentRequest({
        accessKey: 'access-key',
        orderId: 'booking-1',
        partnerCode: 'partner-code',
        requestId: 'payment-1-q',
        secretKey: 'secret-key',
      }),
    ).toEqual({
      endpoint: 'https://test-payment.momo.vn/v2/gateway/api/query',
      body: {
        partnerCode: 'partner-code',
        requestId: 'payment-1-q',
        orderId: 'booking-1',
        lang: 'vi',
        signature: '15724201e8bf82c6c4143347d80aa08f588dd87bf5fbf76a54358fcf2f87d869',
      },
    });
  });

  it('builds official MoMo capture/cancel confirmation fields and signature', () => {
    expect(
      buildMomoConfirmPaymentRequest({
        accessKey: 'access-key',
        amountVnd: 120000,
        description: 'HANDS booking booking-1 capture',
        orderId: 'booking-1',
        partnerCode: 'partner-code',
        requestId: 'payment-1-capture',
        requestType: 'capture',
        secretKey: 'secret-key',
      }),
    ).toEqual({
      endpoint: 'https://test-payment.momo.vn/v2/gateway/api/confirm',
      body: {
        partnerCode: 'partner-code',
        requestId: 'payment-1-capture',
        orderId: 'booking-1',
        requestType: 'capture',
        amount: 120000,
        lang: 'vi',
        description: 'HANDS booking booking-1 capture',
        signature: '965e82a2849e0caa8f1cb22aa985b070b621bc13b99767db59914698101a872f',
      },
    });
  });

  it('builds the official MoMo refund fields and signature', () => {
    expect(
      buildMomoRefundPaymentRequest({
        accessKey: 'access-key',
        amountVnd: 120000,
        description: 'HANDS refund refund-1',
        orderId: 'refund-1',
        partnerCode: 'partner-code',
        requestId: 'refund-1-r',
        secretKey: 'secret-key',
        transId: 3005899645,
      }),
    ).toEqual({
      endpoint: 'https://test-payment.momo.vn/v2/gateway/api/refund',
      body: {
        partnerCode: 'partner-code',
        orderId: 'refund-1',
        requestId: 'refund-1-r',
        amount: 120000,
        transId: 3005899645,
        lang: 'vi',
        description: 'HANDS refund refund-1',
        signature: '5588a30465c2b850d22e78ff0247433da153f4bdbfad1bb4b10f35865c6a64b7',
      },
    });
  });

  it('builds the official MoMo refund query fields and idempotency signature', () => {
    expect(
      buildMomoRefundQueryRequest({
        accessKey: 'access-key',
        orderId: 'refund-1',
        partnerCode: 'partner-code',
        requestId: 'refund-1-rq',
        secretKey: 'secret-key',
      }),
    ).toEqual({
      endpoint: 'https://test-payment.momo.vn/v2/gateway/api/refund/query',
      body: {
        partnerCode: 'partner-code',
        requestId: 'refund-1-rq',
        orderId: 'refund-1',
        lang: 'vi',
        signature: '3a1efb3e6a365ddc143ff76f11f47f4d9107a2c5dab03241e82e7a4f5378ee95',
      },
    });
  });

  it('builds the VNPay v2.1.0 signed checkout URL with VND multiplied by 100', () => {
    const result = buildVnpayCheckoutRequest({
      amountVnd: 120000,
      createDate: '20260714120000',
      expireDate: '20260714121500',
      hashSecret: 'hash-secret',
      ipAddress: '127.0.0.1',
      returnUrl: 'https://hands.vn/payments/return',
      tmnCode: 'DEMOV210',
      txnRef: 'booking-1',
    });

    expect(result.fields).toEqual(
      expect.objectContaining({
        vnp_Amount: '12000000',
        vnp_Command: 'pay',
        vnp_CurrCode: 'VND',
        vnp_SecureHash:
          'e8e149aa90192b9d6efbf437c4c8464441649b7b7d40308d2cd1ca7217bd14520c2b98ebbe45aafcdf3c94bbc72599fc9d947e7377fba1f5a4c2d8f4b5fcf314',
        vnp_Version: '2.1.0',
      }),
    );
    expect(result.checkoutUrl).toContain('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?');
    expect(result.checkoutUrl).toContain('vnp_OrderInfo=HANDS+booking+booking-1');
    expect(result.checkoutUrl).toContain(`vnp_SecureHash=${result.fields.vnp_SecureHash}`);
  });

  it('rejects malformed VNPay dates and non-HTTPS gateway endpoints', () => {
    const valid = {
      amountVnd: 120000,
      createDate: '20260714120000',
      expireDate: '20260714121500',
      hashSecret: 'hash-secret',
      ipAddress: '127.0.0.1',
      returnUrl: 'https://hands.vn/payments/return',
      tmnCode: 'DEMOV210',
      txnRef: 'booking-1',
    };

    expect(() => buildVnpayCheckoutRequest({ ...valid, createDate: '2026-07-14' })).toThrow(
      'VNPay createDate must use yyyyMMddHHmmss in GMT+7',
    );
    expect(() => buildVnpayCheckoutRequest({ ...valid, paymentUrl: 'http://payments.example.test' })).toThrow(
      'VNPay paymentUrl must use HTTPS',
    );
  });

  it('builds the official VNPay querydr request and ordered HMAC-SHA512 signature', () => {
    expect(
      buildVnpayQueryPaymentRequest({
        createDate: '20260714120500',
        hashSecret: 'hash-secret',
        ipAddress: '203.0.113.10',
        orderInfo: 'Query HANDS booking booking-1',
        requestId: 'payment-1-q',
        tmnCode: 'DEMOV210',
        transactionDate: '20260714120000',
        txnRef: 'booking-1',
      }),
    ).toEqual({
      endpoint: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
      body: {
        vnp_RequestId: 'payment-1-q',
        vnp_Version: '2.1.0',
        vnp_Command: 'querydr',
        vnp_TmnCode: 'DEMOV210',
        vnp_TxnRef: 'booking-1',
        vnp_OrderInfo: 'Query HANDS booking booking-1',
        vnp_TransactionDate: '20260714120000',
        vnp_CreateDate: '20260714120500',
        vnp_IpAddr: '203.0.113.10',
        vnp_SecureHash:
          'b6c32dae9a2a0edd70c15c4c25be49793e3e870053ba0b3ec3216c83f8b70834e3f59ea8423d6cc11c9d824aec67d8877913713ad7997985e3ea820c53ab2877',
      },
    });
  });

  it('builds the official VNPay full-refund request and ordered HMAC-SHA512 signature', () => {
    expect(
      buildVnpayRefundPaymentRequest({
        amountVnd: 120000,
        createBy: 'finance-admin-2',
        createDate: '20260714121000',
        hashSecret: 'hash-secret',
        ipAddress: '203.0.113.10',
        orderInfo: 'Refund HANDS booking booking-1',
        requestId: 'refund-1-r',
        tmnCode: 'DEMOV210',
        transactionDate: '20260714120000',
        transactionNo: '14226112',
        txnRef: 'booking-1',
      }),
    ).toEqual({
      endpoint: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
      body: {
        vnp_RequestId: 'refund-1-r',
        vnp_Version: '2.1.0',
        vnp_Command: 'refund',
        vnp_TmnCode: 'DEMOV210',
        vnp_TransactionType: '02',
        vnp_TxnRef: 'booking-1',
        vnp_Amount: '12000000',
        vnp_OrderInfo: 'Refund HANDS booking booking-1',
        vnp_TransactionNo: '14226112',
        vnp_TransactionDate: '20260714120000',
        vnp_CreateBy: 'finance-admin-2',
        vnp_CreateDate: '20260714121000',
        vnp_IpAddr: '203.0.113.10',
        vnp_SecureHash:
          '8921c3b473126b65124ed82a726f0ba76e81573dea952e2007f9d41629c0f1e3fbeba79ec44bebf4050ae22ba1eccf5eb12888d2224cac4a104b77af37e9ac2f',
      },
    });
  });
});
