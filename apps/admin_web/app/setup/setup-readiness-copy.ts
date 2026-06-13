const readinessValueLabels: Readonly<Record<string, string>> = {
  FIREBASE_PROJECT_ID_MISMATCH: 'Firebase Admin project does not match mobile app project',
  MOBILE_FIREBASE_CONFIG_INVALID: 'Mobile Firebase config file is invalid',
  MOBILE_FIREBASE_PROJECT_MISMATCH: 'Customer and Partner Firebase configs use different projects',
};

export function setupReadinessDisplayText(value: string) {
  return (
    readinessValueLabels[value] ??
    value
      .replace(/\bCustomer and provider\b/g, 'Customer and partner')
      .replace(/\bcustomer and provider\b/g, 'customer and partner')
      .replace(/\bprovider Android\b/g, 'partner Android')
      .replace(/\bProvider Android\b/g, 'Partner Android')
      .replace(/\bOS push provider\b/g, 'FCM push service')
      .replace(/\bSMS provider\b/g, 'SMS service')
      .replace(/\bprovider credentials\b/g, 'service credentials')
  );
}
