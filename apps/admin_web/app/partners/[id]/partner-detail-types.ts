import type {
  AdminAuditLog,
  AdminOperatorIdentity,
  AdminProvider,
} from '../../../lib/admin-api';
import type { ReactNode } from 'react';
import type { PartnerDetailBooking } from './partner-detail-record-helpers';
import type { PartnerOpsTone } from './partner-detail-tone';

export type PartnerDispatchPolicy = {
  readonly backupRadiusMeters: number;
  readonly locationFreshnessMinutes: number;
  readonly responseWindowMinutes: number;
};

export type ProviderOpsCard = {
  readonly action: string;
  readonly actionNode?: ReactNode;
  readonly detail: string;
  readonly detailNode?: ReactNode;
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerOpsTone;
};

export type ProviderDetail = AdminProvider & {
  readonly auditLogs?: AdminAuditLog[];
  readonly earnings?: Array<{
    readonly availableAt?: string | null;
    readonly booking?: {
      readonly payment?: {
        readonly amount?: number;
        readonly currency?: string | null;
        readonly method?: string;
        readonly status?: string;
      } | null;
      readonly status?: string;
    } | null;
    readonly bookingId?: string | null;
    readonly createdAt?: string;
    readonly currency?: string | null;
    readonly grossAmount: number;
    readonly id: string;
    readonly netAmount: number;
    readonly paidAt?: string | null;
    readonly platformFee: number;
    readonly settlementNotes?: string | null;
    readonly settlementRef?: string | null;
    readonly status: string;
    readonly withholdingAmount: number;
    readonly walletLedgerEntries?: Array<{
      readonly amount: number;
      readonly createdAt?: string;
      readonly currency?: string | null;
      readonly id: string;
      readonly metadata?: unknown;
      readonly notes?: string | null;
      readonly reference?: string | null;
      readonly sourceKey?: string;
      readonly type: string;
      readonly updatedAt?: string | null;
    }>;
  }>;
  readonly locationSnapshots?: Array<{
    readonly id: string;
    readonly lat: string | number;
    readonly lng: string | number;
    readonly recordedAt: string;
  }>;
  readonly participants?: Array<{
    readonly booking?: PartnerDetailBooking | null;
    readonly id: string;
    readonly joinedAt?: string;
    readonly respondedAt?: string | null;
    readonly status: string;
  }>;
  readonly payoutBatches?: Array<{
    readonly approvalAdmin?: AdminOperatorIdentity | null;
    readonly approvalAdminId?: string | null;
    readonly createdAt?: string;
    readonly createdBy?: AdminOperatorIdentity | null;
    readonly createdByAdminId?: string | null;
    readonly currency?: string | null;
    readonly id: string;
    readonly lastUpdatedBy?: AdminOperatorIdentity | null;
    readonly lastUpdatedByAdminId?: string | null;
    readonly paidAt?: string | null;
    readonly paidBy?: AdminOperatorIdentity | null;
    readonly paidByAdminId?: string | null;
    readonly status: string;
    readonly totalNetAmount: number;
    readonly transferRef?: string | null;
  }>;
  readonly preferredBookings?: PartnerDetailBooking[];
  readonly selectedBookings?: PartnerDetailBooking[];
  readonly verificationLogs?: Array<{
    readonly action: string;
    readonly actor?: {
      readonly fullName?: string | null;
      readonly phone?: string | null;
    } | null;
    readonly createdAt: string;
    readonly fromStatus?: string | null;
    readonly id: string;
    readonly metadata?: unknown;
    readonly toStatus?: string | null;
  }>;
};

export type PartnerEarning = NonNullable<ProviderDetail['earnings']>[number];
export type PartnerEarningsByBookingId = ReadonlyMap<string, PartnerEarning>;
export type ProviderBankAccount = NonNullable<ProviderDetail['bankAccounts']>[number];
export type ProviderPublicFileAsset = NonNullable<
  NonNullable<ProviderDetail['user']>['fileAssets']
>[number];
export type ProviderTaxProfile = NonNullable<ProviderDetail['taxProfile']>;
