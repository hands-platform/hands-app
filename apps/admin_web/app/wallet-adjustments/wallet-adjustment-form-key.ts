const FORM_KEY_FIELDS = [
  'ownerType',
  'ownerId',
  'direction',
  'adjustmentType',
  'amount',
  'monthlyPeriod',
  'attachmentFileId',
  'attachmentFileName',
  'attachmentUrl',
  'operationalCause',
  'expectedCorrection',
  'caseReference',
  'reason',
  'reversalOfRequestId',
] as const;

export type WalletAdjustmentFormKeyInput = Record<(typeof FORM_KEY_FIELDS)[number], string>;

export function walletAdjustmentFormKey(input: WalletAdjustmentFormKeyInput) {
  return FORM_KEY_FIELDS.map((field) => `${field}:${input[field].trim()}`).join('|');
}

export function walletAdjustmentFormKeyFromFormData(formData: FormData) {
  return walletAdjustmentFormKey(
    Object.fromEntries(
      FORM_KEY_FIELDS.map((field) => {
        const value = formData.get(field);
        return [field, typeof value === 'string' ? value : ''];
      }),
    ) as WalletAdjustmentFormKeyInput,
  );
}
