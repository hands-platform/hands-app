export type SettlementJournalSide = 'DEBIT' | 'CREDIT';
export type SettlementJournalPaymentMethod =
  | 'CASH'
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'CUSTOMER_WALLET'
  | 'MOMO'
  | 'VNPAY'
  | 'MANUAL';

export type BookingSettlementJournalInput = {
  bookingId: string;
  currency: string;
  customerPaymentAmount: number;
  partnerPayoutAmount: number;
  partnerWithholdingTotal: number;
  platformFeeNetRevenue: number;
  companyOutputVat: number;
  paymentMethod: SettlementJournalPaymentMethod;
  paymentProcessingFee: number;
  metadata?: Record<string, unknown> | null;
};

export type BookingSettlementJournalEntry = {
  side: SettlementJournalSide;
  accountCode: string;
  accountName: string;
  amount: number;
  currency: string;
  memo: string;
};

export function buildBookingSettlementJournal(input: BookingSettlementJournalInput) {
  const entries: BookingSettlementJournalEntry[] = [];
  const currency = input.currency || 'VND';
  const companyCouponExpense = numberValue(input.metadata?.companyCouponExpense);
  const platformFeeGross = input.platformFeeNetRevenue + input.companyOutputVat;
  const cashPartnerDueBeforeCoupon = platformFeeGross + input.partnerWithholdingTotal;
  const cashPartnerReceivable = Math.max(0, cashPartnerDueBeforeCoupon - companyCouponExpense);
  const cashPartnerCouponSubsidyPayable = Math.max(0, companyCouponExpense - cashPartnerDueBeforeCoupon);

  if (input.paymentMethod === 'CASH') {
    addEntry(entries, {
      accountCode: 'partner_receivable_negative_wallet',
      accountName: 'Partner receivable / negative wallet',
      amount: cashPartnerReceivable,
      currency,
      memo: `Cash booking ${input.bookingId} creates partner receivable after company coupon funding.`,
      side: 'DEBIT',
    });
  } else if (input.paymentMethod === 'CUSTOMER_WALLET') {
    addEntry(entries, {
      accountCode: 'customer_wallet_liability',
      accountName: 'Customer wallet liability',
      amount: input.customerPaymentAmount,
      currency,
      memo: `Customer wallet debit for booking ${input.bookingId}; no external payment clearing.`,
      side: 'DEBIT',
    });
  } else {
    addEntry(entries, {
      accountCode: 'booking_payment_clearing',
      accountName: 'Booking payment clearing / payment receivable',
      amount: input.customerPaymentAmount,
      currency,
      memo: `Customer payment for booking ${input.bookingId}; not company revenue.`,
      side: 'DEBIT',
    });
  }

  addEntry(entries, {
    accountCode: 'payment_processing_fee_expense',
    accountName: 'Payment processing fee expense',
    amount: input.paymentProcessingFee,
    currency,
    memo: 'Payment provider fee is operating cost, not tax or revenue.',
    side: 'DEBIT',
  });
  addEntry(entries, {
    accountCode: 'customer_coupon_marketing_expense',
    accountName: 'Customer coupon marketing expense',
    amount: companyCouponExpense,
    currency,
    memo: 'Company-funded coupon is marketing expense, not reduced platform fee revenue.',
    side: 'DEBIT',
  });

  if (input.paymentMethod !== 'CASH' || cashPartnerCouponSubsidyPayable > 0) {
    addEntry(entries, {
      accountCode: 'partner_wallet_liability',
      accountName: 'Partner wallet liability',
      amount:
        input.paymentMethod === 'CASH'
          ? cashPartnerCouponSubsidyPayable
          : input.partnerPayoutAmount,
      currency,
      memo:
        input.paymentMethod === 'CASH'
          ? 'Company coupon funding exceeds cash fees due and becomes payable to the partner.'
          : 'Partner wallet liability credited for the actual partner payout; withholding is tracked separately.',
      side: 'CREDIT',
    });
  }

  addEntry(entries, {
    accountCode: 'partner_vat_pit_payable',
    accountName: 'Partner VAT/PIT payable',
    amount: input.partnerWithholdingTotal,
    currency,
    memo: 'Partner VAT/PIT withheld for later remittance.',
    side: 'CREDIT',
  });
  addEntry(entries, {
    accountCode: 'platform_fee_net_revenue',
    accountName: 'Platform fee net revenue',
    amount: input.platformFeeNetRevenue,
    currency,
    memo: 'Company revenue is platform fee net of company output VAT.',
    side: 'CREDIT',
  });
  addEntry(entries, {
    accountCode: 'company_output_vat_payable',
    accountName: 'Company output VAT payable',
    amount: input.companyOutputVat,
    currency,
    memo: 'Company output VAT payable from platform fee.',
    side: 'CREDIT',
  });
  addEntry(entries, {
    accountCode: 'payment_processing_fee_clearing',
    accountName: 'Payment processing fee clearing',
    amount: input.paymentProcessingFee,
    currency,
    memo: 'Payment processing fee settlement clearing.',
    side: 'CREDIT',
  });

  const totalDebit = sumEntries(entries, 'DEBIT');
  const totalCredit = sumEntries(entries, 'CREDIT');
  const reconciliationDelta = totalDebit - totalCredit;

  if (reconciliationDelta > 0) {
    addEntry(entries, {
      accountCode: 'settlement_reconciliation_delta',
      accountName: 'Settlement reconciliation delta',
      amount: reconciliationDelta,
      currency,
      memo: 'Explicit delta from legacy/incomplete settlement inputs; must be reviewed before closing.',
      side: 'CREDIT',
    });
  } else if (reconciliationDelta < 0) {
    addEntry(entries, {
      accountCode: 'settlement_reconciliation_delta',
      accountName: 'Settlement reconciliation delta',
      amount: Math.abs(reconciliationDelta),
      currency,
      memo: 'Explicit delta from legacy/incomplete settlement inputs; must be reviewed before closing.',
      side: 'DEBIT',
    });
  }

  return {
    entries,
    reconciliationDelta,
    totalCredit: sumEntries(entries, 'CREDIT'),
    totalDebit: sumEntries(entries, 'DEBIT'),
  };
}

function addEntry(entries: BookingSettlementJournalEntry[], entry: BookingSettlementJournalEntry) {
  if (entry.amount <= 0) {
    return;
  }
  entries.push(entry);
}

function sumEntries(entries: BookingSettlementJournalEntry[], side: SettlementJournalSide) {
  return entries.filter((entry) => entry.side === side).reduce((total, entry) => total + entry.amount, 0);
}

function numberValue(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}
