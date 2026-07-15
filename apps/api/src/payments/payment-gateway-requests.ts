import { hmacHex } from './payment-callback.helpers';

const MOMO_SANDBOX_BASE_URL = 'https://test-payment.momo.vn';
const VNPAY_SANDBOX_PAYMENT_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const VNPAY_SANDBOX_TRANSACTION_URL =
  'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';

export type MomoCreatePaymentInput = {
  accessKey: string;
  amountVnd: number;
  ipnUrl: string;
  orderId: string;
  orderInfo: string;
  partnerCode: string;
  redirectUrl: string;
  requestId: string;
  secretKey: string;
  baseUrl?: string;
  extraData?: string;
  lang?: 'en' | 'vi';
  autoCapture?: boolean;
};

export function buildMomoCreatePaymentRequest(input: MomoCreatePaymentInput) {
  assertIntegerAmount(input.amountVnd, 1_000, 50_000_000, 'MoMo');
  assertMerchantReference(input.orderId, 64, 'MoMo orderId');
  assertMerchantReference(input.requestId, 50, 'MoMo requestId');
  assertHttpUrl(input.ipnUrl, 'MoMo ipnUrl');
  assertHttpUrl(input.redirectUrl, 'MoMo redirectUrl');

  const body = {
    partnerCode: required(input.partnerCode, 'MoMo partnerCode'),
    requestId: input.requestId,
    amount: input.amountVnd,
    orderId: input.orderId,
    orderInfo: required(input.orderInfo, 'MoMo orderInfo'),
    redirectUrl: input.redirectUrl,
    ipnUrl: input.ipnUrl,
    requestType: 'captureWallet' as const,
    extraData: input.extraData ?? '',
    lang: input.lang ?? ('vi' as const),
    autoCapture: input.autoCapture ?? true,
  };
  const signingMaterial = [
    `accessKey=${required(input.accessKey, 'MoMo accessKey')}`,
    `amount=${body.amount}`,
    `extraData=${body.extraData}`,
    `ipnUrl=${body.ipnUrl}`,
    `orderId=${body.orderId}`,
    `orderInfo=${body.orderInfo}`,
    `partnerCode=${body.partnerCode}`,
    `redirectUrl=${body.redirectUrl}`,
    `requestId=${body.requestId}`,
    `requestType=${body.requestType}`,
  ].join('&');
  const baseUrl = normalizedBaseUrl(input.baseUrl ?? MOMO_SANDBOX_BASE_URL, 'MoMo baseUrl');

  return {
    endpoint: `${baseUrl}/v2/gateway/api/create`,
    body: {
      ...body,
      signature: hmacHex('sha256', required(input.secretKey, 'MoMo secretKey'), signingMaterial),
    },
  };
}

export type MomoQueryPaymentInput = {
  accessKey: string;
  orderId: string;
  partnerCode: string;
  requestId: string;
  secretKey: string;
  baseUrl?: string;
  lang?: 'en' | 'vi';
};

export function buildMomoQueryPaymentRequest(input: MomoQueryPaymentInput) {
  assertMerchantReference(input.orderId, 64, 'MoMo orderId');
  assertMerchantReference(input.requestId, 50, 'MoMo requestId');
  const partnerCode = required(input.partnerCode, 'MoMo partnerCode');
  const signingMaterial = [
    `accessKey=${required(input.accessKey, 'MoMo accessKey')}`,
    `orderId=${input.orderId}`,
    `partnerCode=${partnerCode}`,
    `requestId=${input.requestId}`,
  ].join('&');
  const baseUrl = normalizedBaseUrl(input.baseUrl ?? MOMO_SANDBOX_BASE_URL, 'MoMo baseUrl');

  return {
    endpoint: `${baseUrl}/v2/gateway/api/query`,
    body: {
      partnerCode,
      requestId: input.requestId,
      orderId: input.orderId,
      lang: input.lang ?? ('vi' as const),
      signature: hmacHex('sha256', required(input.secretKey, 'MoMo secretKey'), signingMaterial),
    },
  };
}

export type MomoConfirmPaymentInput = {
  accessKey: string;
  amountVnd: number;
  description: string;
  orderId: string;
  partnerCode: string;
  requestId: string;
  requestType: 'capture' | 'cancel';
  secretKey: string;
  baseUrl?: string;
  lang?: 'en' | 'vi';
};

export function buildMomoConfirmPaymentRequest(input: MomoConfirmPaymentInput) {
  assertIntegerAmount(input.amountVnd, 1_000, 50_000_000, 'MoMo');
  assertMerchantReference(input.orderId, 64, 'MoMo orderId');
  assertMerchantReference(input.requestId, 50, 'MoMo requestId');
  const partnerCode = required(input.partnerCode, 'MoMo partnerCode');
  const description = required(input.description, 'MoMo confirmation description');
  const signingMaterial = [
    `accessKey=${required(input.accessKey, 'MoMo accessKey')}`,
    `amount=${input.amountVnd}`,
    `description=${description}`,
    `orderId=${input.orderId}`,
    `partnerCode=${partnerCode}`,
    `requestId=${input.requestId}`,
    `requestType=${input.requestType}`,
  ].join('&');
  const baseUrl = normalizedBaseUrl(input.baseUrl ?? MOMO_SANDBOX_BASE_URL, 'MoMo baseUrl');

  return {
    endpoint: `${baseUrl}/v2/gateway/api/confirm`,
    body: {
      partnerCode,
      requestId: input.requestId,
      orderId: input.orderId,
      requestType: input.requestType,
      amount: input.amountVnd,
      lang: input.lang ?? ('vi' as const),
      description,
      signature: hmacHex('sha256', required(input.secretKey, 'MoMo secretKey'), signingMaterial),
    },
  };
}

export type MomoRefundPaymentInput = {
  accessKey: string;
  amountVnd: number;
  description: string;
  orderId: string;
  partnerCode: string;
  requestId: string;
  secretKey: string;
  transId: string | number;
  baseUrl?: string;
  lang?: 'en' | 'vi';
};

export function buildMomoRefundPaymentRequest(input: MomoRefundPaymentInput) {
  assertIntegerAmount(input.amountVnd, 1_000, 50_000_000, 'MoMo');
  assertMerchantReference(input.orderId, 64, 'MoMo refund orderId');
  assertMerchantReference(input.requestId, 50, 'MoMo refund requestId');
  const partnerCode = required(input.partnerCode, 'MoMo partnerCode');
  const description = required(input.description, 'MoMo refund description');
  const transId = positiveSafeInteger(input.transId, 'MoMo transId');
  const signingMaterial = [
    `accessKey=${required(input.accessKey, 'MoMo accessKey')}`,
    `amount=${input.amountVnd}`,
    `description=${description}`,
    `orderId=${input.orderId}`,
    `partnerCode=${partnerCode}`,
    `requestId=${input.requestId}`,
    `transId=${transId}`,
  ].join('&');
  const baseUrl = normalizedBaseUrl(input.baseUrl ?? MOMO_SANDBOX_BASE_URL, 'MoMo baseUrl');

  return {
    endpoint: `${baseUrl}/v2/gateway/api/refund`,
    body: {
      partnerCode,
      orderId: input.orderId,
      requestId: input.requestId,
      amount: input.amountVnd,
      transId,
      lang: input.lang ?? ('vi' as const),
      description,
      signature: hmacHex('sha256', required(input.secretKey, 'MoMo secretKey'), signingMaterial),
    },
  };
}

export type MomoRefundQueryInput = {
  accessKey: string;
  orderId: string;
  partnerCode: string;
  requestId: string;
  secretKey: string;
  baseUrl?: string;
  lang?: 'en' | 'vi';
};

export function buildMomoRefundQueryRequest(input: MomoRefundQueryInput) {
  assertMerchantReference(input.orderId, 64, 'MoMo refund query orderId');
  assertMerchantReference(input.requestId, 50, 'MoMo refund query requestId');
  const partnerCode = required(input.partnerCode, 'MoMo partnerCode');
  const signingMaterial = [
    `accessKey=${required(input.accessKey, 'MoMo accessKey')}`,
    `orderId=${input.orderId}`,
    `partnerCode=${partnerCode}`,
    `requestId=${input.requestId}`,
  ].join('&');
  const baseUrl = normalizedBaseUrl(input.baseUrl ?? MOMO_SANDBOX_BASE_URL, 'MoMo baseUrl');

  return {
    endpoint: `${baseUrl}/v2/gateway/api/refund/query`,
    body: {
      partnerCode,
      requestId: input.requestId,
      orderId: input.orderId,
      lang: input.lang ?? ('vi' as const),
      signature: hmacHex('sha256', required(input.secretKey, 'MoMo secretKey'), signingMaterial),
    },
  };
}

export type VnpayCheckoutInput = {
  amountVnd: number;
  createDate: string;
  expireDate: string;
  hashSecret: string;
  ipAddress: string;
  returnUrl: string;
  tmnCode: string;
  txnRef: string;
  locale?: 'en' | 'vn';
  orderInfo?: string;
  orderType?: string;
  paymentUrl?: string;
};

export function buildVnpayCheckoutRequest(input: VnpayCheckoutInput) {
  assertIntegerAmount(input.amountVnd, 1, 999_999_999, 'VNPay');
  assertVnpayDate(input.createDate, 'VNPay createDate');
  assertVnpayDate(input.expireDate, 'VNPay expireDate');
  assertMerchantReference(input.txnRef, 100, 'VNPay txnRef');
  assertHttpUrl(input.returnUrl, 'VNPay returnUrl');

  const fields = {
    vnp_Amount: String(input.amountVnd * 100),
    vnp_Command: 'pay',
    vnp_CreateDate: input.createDate,
    vnp_CurrCode: 'VND',
    vnp_ExpireDate: input.expireDate,
    vnp_IpAddr: required(input.ipAddress, 'VNPay ipAddress'),
    vnp_Locale: input.locale ?? 'vn',
    vnp_OrderInfo: input.orderInfo ?? `HANDS booking ${input.txnRef}`,
    vnp_OrderType: input.orderType ?? 'other',
    vnp_ReturnUrl: input.returnUrl,
    vnp_TmnCode: required(input.tmnCode, 'VNPay tmnCode'),
    vnp_TxnRef: input.txnRef,
    vnp_Version: '2.1.0',
  };
  const query = vnpayQueryString(fields);
  const secureHash = hmacHex('sha512', required(input.hashSecret, 'VNPay hashSecret'), query);
  const paymentUrl = new URL(input.paymentUrl ?? VNPAY_SANDBOX_PAYMENT_URL);
  if (paymentUrl.protocol !== 'https:') {
    throw new Error('VNPay paymentUrl must use HTTPS');
  }
  paymentUrl.search = `${query}&vnp_SecureHash=${secureHash}`;

  return {
    checkoutUrl: paymentUrl.toString(),
    fields: { ...fields, vnp_SecureHash: secureHash },
  };
}

export type VnpayQueryPaymentInput = {
  createDate: string;
  hashSecret: string;
  ipAddress: string;
  orderInfo: string;
  requestId: string;
  tmnCode: string;
  transactionDate: string;
  txnRef: string;
  apiUrl?: string;
};

export function buildVnpayQueryPaymentRequest(input: VnpayQueryPaymentInput) {
  assertMerchantReference(input.requestId, 32, 'VNPay requestId');
  assertMerchantReference(input.txnRef, 100, 'VNPay txnRef');
  assertVnpayDate(input.transactionDate, 'VNPay transactionDate');
  assertVnpayDate(input.createDate, 'VNPay createDate');
  const body = {
    vnp_RequestId: input.requestId,
    vnp_Version: '2.1.0',
    vnp_Command: 'querydr',
    vnp_TmnCode: required(input.tmnCode, 'VNPay tmnCode'),
    vnp_TxnRef: input.txnRef,
    vnp_OrderInfo: required(input.orderInfo, 'VNPay query orderInfo'),
    vnp_TransactionDate: input.transactionDate,
    vnp_CreateDate: input.createDate,
    vnp_IpAddr: required(input.ipAddress, 'VNPay ipAddress'),
  };
  const signingMaterial = [
    body.vnp_RequestId,
    body.vnp_Version,
    body.vnp_Command,
    body.vnp_TmnCode,
    body.vnp_TxnRef,
    body.vnp_TransactionDate,
    body.vnp_CreateDate,
    body.vnp_IpAddr,
    body.vnp_OrderInfo,
  ].join('|');

  return {
    endpoint: vnpayTransactionUrl(input.apiUrl),
    body: {
      ...body,
      vnp_SecureHash: hmacHex(
        'sha512',
        required(input.hashSecret, 'VNPay hashSecret'),
        signingMaterial,
      ),
    },
  };
}

export type VnpayRefundPaymentInput = VnpayQueryPaymentInput & {
  amountVnd: number;
  createBy: string;
  transactionNo?: string;
};

export function buildVnpayRefundPaymentRequest(input: VnpayRefundPaymentInput) {
  assertIntegerAmount(input.amountVnd, 1, 999_999_999, 'VNPay');
  assertMerchantReference(input.requestId, 32, 'VNPay requestId');
  assertMerchantReference(input.txnRef, 100, 'VNPay txnRef');
  assertVnpayDate(input.transactionDate, 'VNPay transactionDate');
  assertVnpayDate(input.createDate, 'VNPay createDate');
  const body = {
    vnp_RequestId: input.requestId,
    vnp_Version: '2.1.0',
    vnp_Command: 'refund',
    vnp_TmnCode: required(input.tmnCode, 'VNPay tmnCode'),
    vnp_TransactionType: '02',
    vnp_TxnRef: input.txnRef,
    vnp_Amount: String(input.amountVnd * 100),
    vnp_OrderInfo: required(input.orderInfo, 'VNPay refund orderInfo'),
    vnp_TransactionNo: input.transactionNo?.trim() ?? '',
    vnp_TransactionDate: input.transactionDate,
    vnp_CreateBy: required(input.createBy, 'VNPay createBy'),
    vnp_CreateDate: input.createDate,
    vnp_IpAddr: required(input.ipAddress, 'VNPay ipAddress'),
  };
  const signingMaterial = [
    body.vnp_RequestId,
    body.vnp_Version,
    body.vnp_Command,
    body.vnp_TmnCode,
    body.vnp_TransactionType,
    body.vnp_TxnRef,
    body.vnp_Amount,
    body.vnp_TransactionNo,
    body.vnp_TransactionDate,
    body.vnp_CreateBy,
    body.vnp_CreateDate,
    body.vnp_IpAddr,
    body.vnp_OrderInfo,
  ].join('|');

  return {
    endpoint: vnpayTransactionUrl(input.apiUrl),
    body: {
      ...body,
      vnp_SecureHash: hmacHex(
        'sha512',
        required(input.hashSecret, 'VNPay hashSecret'),
        signingMaterial,
      ),
    },
  };
}

export function vnpayQueryString(fields: Record<string, string>) {
  const params = new URLSearchParams();
  for (const key of Object.keys(fields).sort()) {
    params.append(key, fields[key]);
  }
  return params.toString();
}

function assertIntegerAmount(amount: number, minimum: number, maximum: number, provider: string) {
  if (!Number.isSafeInteger(amount) || amount < minimum || amount > maximum) {
    throw new Error(`${provider} amount must be an integer between ${minimum} and ${maximum} VND`);
  }
}

function positiveSafeInteger(value: string | number, field: string) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
}

function assertMerchantReference(value: string, maxBytes: number, field: string) {
  if (!/^[0-9a-zA-Z]([-_.]*[0-9a-zA-Z]+)*$/.test(value) || Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw new Error(`${field} is invalid`);
  }
}

function assertVnpayDate(value: string, field: string) {
  if (!/^\d{14}$/.test(value)) {
    throw new Error(`${field} must use yyyyMMddHHmmss in GMT+7`);
  }
}

function assertHttpUrl(value: string, field: string) {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${field} must use HTTP or HTTPS`);
  }
}

function normalizedBaseUrl(value: string, field: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error(`${field} must use HTTPS`);
  }
  return value.replace(/\/+$/, '');
}

function vnpayTransactionUrl(value = VNPAY_SANDBOX_TRANSACTION_URL) {
  const url = new URL(value);
  if (url.protocol !== 'https:') {
    throw new Error('VNPay apiUrl must use HTTPS');
  }
  return url.toString();
}

function required(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}
