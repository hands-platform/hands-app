import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  bpsAmount,
  money,
  readAmount,
  readNullableAmount,
  shortId,
} from './booking-formatters';
import {
  readServicePayoutSnapshot,
  servicePayoutLineForBooking,
} from './booking-service-payout-snapshot';

export function bookingFinanceTrace(booking: AdminBookingDetail) {
  const bookedService = booking.services?.[0];
  const service = bookedService?.service;
  const currency = booking.payment?.currency ?? booking.earning?.currency ?? 'VND';
  const customerPrice = bookedService?.price ?? booking.payment?.amount;
  const payoutRule = service?.payoutRules?.find(
    (rule) => Number(rule.customerPrice) === Number(customerPrice),
  );
  const platformFeeFromRule =
    payoutRule && customerPrice !== undefined
      ? Number(customerPrice) - Number(payoutRule.providerPayoutAmount)
      : null;
  const vatAmount =
    payoutRule && platformFeeFromRule !== null ? bpsAmount(platformFeeFromRule, payoutRule.vatBps) : null;
  const otherCostAmount = payoutRule ? Number(payoutRule.otherCostAmount ?? 0) : null;
  const netHandsFee =
    platformFeeFromRule !== null ? platformFeeFromRule - (vatAmount ?? 0) - (otherCostAmount ?? 0) : null;
  const latestTaxLog = booking.taxLogs?.[0] ?? booking.earning?.taxLogs?.[0];
  const latestFeeLog = booking.platformFeeLogs?.[0] ?? booking.earning?.platformFeeLogs?.[0];
  const servicePayoutSnapshot = readServicePayoutSnapshot(latestFeeLog?.ruleSnapshot);
  const servicePayoutLine = servicePayoutLineForBooking(servicePayoutSnapshot, customerPrice);
  const snapshotProviderPayout =
    readNullableAmount(servicePayoutLine?.providerPayoutAmount) ??
    readNullableAmount(servicePayoutSnapshot?.providerPayoutAmount);
  const snapshotPlatformFee =
    readNullableAmount(servicePayoutLine?.platformFeeAmount) ??
    readNullableAmount(latestFeeLog?.platformFeeAmount);
  const snapshotVatAmount =
    readNullableAmount(servicePayoutLine?.vatAmount) ?? readNullableAmount(servicePayoutSnapshot?.vatAmount);
  const snapshotOtherCostAmount =
    readNullableAmount(servicePayoutLine?.otherCostAmount) ??
    readNullableAmount(servicePayoutSnapshot?.otherCostAmount);
  const platformFeeAmount = snapshotPlatformFee ?? platformFeeFromRule;
  const providerPayoutAmount =
    snapshotProviderPayout ??
    (payoutRule ? Number(payoutRule.providerPayoutAmount) : null) ??
    (booking.earning ? booking.earning.grossAmount - booking.earning.platformFee : null);
  const feeVatAmount = snapshotVatAmount ?? vatAmount;
  const feeOtherCostAmount = snapshotOtherCostAmount ?? otherCostAmount;
  const netHandsFeeAmount =
    readNullableAmount(servicePayoutSnapshot?.netCompanyFeeBeforeWithholding) ??
    (platformFeeAmount !== null
      ? platformFeeAmount - (feeVatAmount ?? 0) - (feeOtherCostAmount ?? 0)
      : null) ??
    netHandsFee;
  const withholdingAmount =
    readNullableAmount(latestTaxLog?.withholdingAmount) ??
    readNullableAmount(booking.earning?.withholdingAmount);
  const walletEntries = booking.walletLedgerEntries ?? booking.earning?.walletLedgerEntries ?? [];
  const walletTotal = walletEntries.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0);
  const quantity = bookedService?.quantity ?? 1;
  const companyFeeAfterTaxAmount =
    netHandsFeeAmount !== null ? netHandsFeeAmount - (withholdingAmount ?? 0) : null;

  return {
    currency,
    paymentMethod: booking.payment?.method ?? 'NONE',
    earningStatus: booking.earning?.status ?? null,
    customerPriceAmount: readNullableAmount(customerPrice),
    adminMinimumAmount: readNullableAmount(service?.basePrice),
    payoutRuleMissing: !payoutRule,
    providerPayoutAmount,
    platformFeeAmount,
    feeVatAmount,
    feeOtherCostAmount,
    netHandsFeeAmount,
    withholdingAmount,
    companyFeeAfterTaxAmount,
    walletTotalAmount: walletTotal,
    pricingSource:
      servicePayoutSnapshot?.source === 'SERVICE_PAYOUT_RULE'
        ? 'Service payout matrix'
        : latestFeeLog
          ? `Fee policy ${servicePayoutSnapshot?.scope ?? 'RULE'}`
          : payoutRule
            ? 'Projected from active payout rule'
            : 'Not calculated',
    serviceOption: service?.name
      ? `${service.name} / ${service.durationMin ?? '-'} min / qty ${quantity}`
      : 'Service pending',
    customerPrice: money(customerPrice, currency),
    adminMinimum: money(service?.basePrice, currency),
    payoutRuleStatus: payoutRule
      ? `${money(Number(payoutRule.customerPrice), payoutRule.currency ?? currency)} active`
      : 'Missing active rule',
    payoutRuleLine: servicePayoutLine
      ? `${money(readAmount(servicePayoutLine.customerPrice), currency)} customer -> ${money(
          readAmount(servicePayoutLine.providerPayoutAmount),
          currency,
        )} Partner`
      : payoutRule
        ? `Active rule ${shortId(payoutRule.id)}`
        : 'No matching rule line',
    providerPayout:
      providerPayoutAmount !== null
        ? money(providerPayoutAmount, servicePayoutSnapshot?.currency ?? payoutRule?.currency ?? currency)
        : 'Not calculated',
    platformFee:
      platformFeeAmount !== null
        ? `${money(platformFeeAmount, latestFeeLog?.currency ?? currency)}${latestFeeLog ? ' logged' : ''}`
        : 'Not calculated',
    feeCosts:
      feeVatAmount !== null || feeOtherCostAmount !== null
        ? `${money(feeVatAmount ?? 0, currency)} VAT / ${money(feeOtherCostAmount ?? 0, currency)} other`
        : 'No active rule snapshot',
    netHandsFee: netHandsFeeAmount !== null ? money(netHandsFeeAmount, currency) : 'Not calculated',
    withholding: latestTaxLog
      ? `${money(latestTaxLog.withholdingAmount, latestTaxLog.currency)} on ${money(latestTaxLog.taxableAmount, latestTaxLog.currency)}`
      : booking.earning
        ? money(booking.earning.withholdingAmount, booking.earning.currency)
        : 'Not created',
    companyFeeAfterTax:
      companyFeeAfterTaxAmount !== null ? money(companyFeeAfterTaxAmount, currency) : 'Not calculated',
    walletLedger:
      walletEntries.length > 0
        ? `${money(walletTotal, walletEntries[0]?.currency ?? currency)} / ${walletEntries.length} entry`
        : 'No entry',
    providerNet: booking.earning
      ? `${money(booking.earning.netAmount, booking.earning.currency)} / ${booking.earning.status}`
      : 'Not created',
  };
}
