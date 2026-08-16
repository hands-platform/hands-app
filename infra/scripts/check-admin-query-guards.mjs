import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const adminServicePath = resolve(root, 'apps/api/src/admin/admin.service.ts');
const adminUsageOverviewPath = resolve(root, 'apps/api/src/admin/admin-usage-overview.ts');
const adminCustomerSelectsPath = resolve(root, 'apps/api/src/admin/admin-customer-selects.ts');
const adminProviderProfileSelectsPath = resolve(root, 'apps/api/src/admin/admin-provider-profile-selects.ts');
const adminWebAppRoot = resolve(root, 'apps/admin_web/app');
const notificationPageModelPath = resolve(root, 'apps/admin_web/app/notifications/notification-page-model.ts');
const pushSendPageModelPath = resolve(root, 'apps/admin_web/app/notifications/push-send/push-send-page-model.ts');
const appSessionsPageModelPath = resolve(root, 'apps/admin_web/app/app-sessions/app-sessions-page-model.ts');
const chatArchivePageModelPath = resolve(root, 'apps/admin_web/app/chat-archive/chat-archive-page-model.ts');
const usageOverviewPageModelPath = resolve(root, 'apps/admin_web/app/usage-overview/usage-overview-model.ts');

const violations = [];

const adminServiceSource = readFileSync(adminServicePath, 'utf8');
const adminUsageOverviewSource = readFileSync(adminUsageOverviewPath, 'utf8');
const adminCustomerSelectsSource = readFileSync(adminCustomerSelectsPath, 'utf8');
const adminProviderProfileSelectsSource = readFileSync(adminProviderProfileSelectsPath, 'utf8');
const notificationPageModelSource = readFileSync(notificationPageModelPath, 'utf8');
const pushSendPageModelSource = readFileSync(pushSendPageModelPath, 'utf8');
const appSessionsPageModelSource = readFileSync(appSessionsPageModelPath, 'utf8');
const chatArchivePageModelSource = readFileSync(chatArchivePageModelPath, 'utf8');
const usageOverviewPageModelSource = readFileSync(usageOverviewPageModelPath, 'utf8');
const adminProviderGuardSource = `${adminServiceSource}\n${adminProviderProfileSelectsSource}`;

function sourceBetweenIn(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return '';
  const end = source.indexOf(endMarker, start + startMarker.length);
  return source.slice(start, end === -1 ? undefined : end);
}

function sourceBetween(startMarker, endMarker) {
  return sourceBetweenIn(adminServiceSource, startMarker, endMarker);
}

const providerListSource = sourceBetween('async listProviders', 'async getProviderDetail');
const notificationListSource = sourceBetween('listNotifications', 'async notificationSummary');
const notificationSummarySource = sourceBetween('async notificationSummary', 'async listNotificationTemplates');
const pushCampaignListSource = sourceBetween('listAdminPushCampaigns', 'async adminPushCampaignSummary');
const pushCampaignSummarySource = sourceBetween('async adminPushCampaignSummary', 'async previewAdminPushCampaign');
const pushCampaignPreviewSource = sourceBetween('async previewAdminPushCampaign', 'async confirmAdminPushCampaign');
const pushCampaignConfirmSource = sourceBetween('async confirmAdminPushCampaign', 'private async resolveAdminPushAudience');
const pushCampaignAudienceSource = sourceBetween('private async resolveAdminPushAudience', 'private async failAdminPushCampaignQueue');
const pushCampaignEvidenceSource = sourceBetween('async adminPushCampaignEvidence', 'async previewAdminPushCampaign');
const customerDirectorySelectSource = sourceBetweenIn(
  adminCustomerSelectsSource,
  'export const adminCustomerDirectorySelect',
  'const adminCustomerNotificationDeliverySelect',
);

if (!adminServiceSource.includes('const ADMIN_APP_SESSION_LIST_LIMIT = 50;')) {
  violations.push({
    area: 'admin app session query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'App session list query must keep the 50-row operations guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_BOOKING_LIST_LIMIT = 50;')) {
  violations.push({
    area: 'admin booking query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Booking list query must keep the 50-row operations guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CHAT_ARCHIVE_LIST_LIMIT = 50;')) {
  violations.push({
    area: 'admin chat archive query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Chat archive list query must keep the 50-row operations guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_NOTIFICATION_BOARD_DEFAULT_LIMIT = 20;')) {
  violations.push({
    area: 'admin notification query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Notification board must keep the 20-row default page size.',
  });
}

if (!adminServiceSource.includes('const ADMIN_NOTIFICATION_BOARD_MAX_LIMIT = 20;')) {
  violations.push({
    area: 'admin notification query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Notification board must keep the 20-row hard maximum page size.',
  });
}

if (!adminServiceSource.includes('const ADMIN_PUSH_CAMPAIGN_RECIPIENT_LIMIT = 100;')) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push sends must keep a hard 100-recipient limit.',
  });
}

if (!adminServiceSource.includes('const ADMIN_PUSH_CAMPAIGN_HISTORY_DEFAULT_LIMIT = 20;')) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push campaign history must keep the 20-row default page size.',
  });
}

if (!adminServiceSource.includes('const ADMIN_PUSH_CAMPAIGN_HISTORY_MAX_LIMIT = 50;')) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push campaign history must keep the 50-row hard maximum page size.',
  });
}

if (!adminUsageOverviewSource.includes("const DEFAULT_USAGE_RANGE: AdminUsageOverviewRange = 'today';")) {
  violations.push({
    area: 'admin usage overview query',
    file: 'apps/api/src/admin/admin-usage-overview.ts',
    message: 'Usage overview must default to today for the initial operations view.',
  });
}

if (!adminServiceSource.includes('const ADMIN_USAGE_OVERVIEW_RANK_LIMIT = 10;')) {
  violations.push({
    area: 'admin usage overview query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Usage overview ranking queries must keep a 10-row limit.',
  });
}

if (!adminServiceSource.includes('const ADMIN_USAGE_OVERVIEW_REGION_LIMIT = 100;')) {
  violations.push({
    area: 'admin usage overview query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Usage overview region sample queries must keep the 100-row cost guard.',
  });
}

if (!adminServiceSource.includes('take: adminAppSessionListTake(options.take),')) {
  violations.push({
    area: 'admin app session query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'App session list query must apply bounded server pagination.',
  });
}

if (!adminServiceSource.includes('const where = adminAppSessionListWhere(options);')) {
  violations.push({
    area: 'admin app session query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'App session list query must apply server-side filters.',
  });
}

if (!adminServiceSource.includes('const skip = adminAppSessionListSkip(options.skip);')) {
  violations.push({
    area: 'admin app session query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'App session list query must apply bounded server pagination offsets.',
  });
}

if (!appSessionsPageModelSource.includes('const DEFAULT_APP_SESSION_LIST_TAKE = 10;')) {
  violations.push({
    area: 'admin app session page',
    file: 'apps/admin_web/app/app-sessions/app-sessions-page-model.ts',
    message: 'App sessions page API calls must keep a 10-row default page size.',
  });
}

if (!appSessionsPageModelSource.includes('buildAppSessionApiHref')) {
  violations.push({
    area: 'admin app session page',
    file: 'apps/admin_web/app/app-sessions/app-sessions-page-model.ts',
    message: 'App sessions page must build bounded filtered API requests.',
  });
}

if (
  !adminServiceSource.includes('take: ADMIN_BOOKING_LIST_LIMIT,') &&
  !adminServiceSource.includes('take: adminBookingListLimit(query.take),')
) {
  violations.push({
    area: 'admin booking query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Booking list query must apply ADMIN_BOOKING_LIST_LIMIT.',
  });
}

if (!adminServiceSource.includes('take: adminChatArchiveListTake(query.take),')) {
  violations.push({
    area: 'admin chat archive query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Chat archive list query must apply bounded server pagination.',
  });
}

if (!adminServiceSource.includes('where: adminChatArchiveMessageWhere(query),')) {
  violations.push({
    area: 'admin chat archive query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Chat archive list query must apply the server-side message evidence predicate.',
  });
}

if (!chatArchivePageModelSource.includes('const CHAT_ARCHIVE_DEFAULT_TAKE = 10;')) {
  violations.push({
    area: 'admin chat archive page',
    file: 'apps/admin_web/app/chat-archive/chat-archive-page-model.ts',
    message: 'Chat archive page must keep a narrow default room load size.',
  });
}

if (!chatArchivePageModelSource.includes("? range : 'all';")) {
  violations.push({
    area: 'admin chat archive page',
    file: 'apps/admin_web/app/chat-archive/chat-archive-page-model.ts',
    message: 'Chat archive page must default evidence search to all dates.',
  });
}

if (
  chatArchivePageModelSource.includes('directBookingId') &&
  !chatArchivePageModelSource.includes('normalizedParams.q = directBookingId;')
) {
  violations.push({
    area: 'admin chat archive page',
    file: 'apps/admin_web/app/chat-archive/chat-archive-page-model.ts',
    message: 'Chat archive direct booking lookup must remain an exact bounded search.',
  });
}

if (!usageOverviewPageModelSource.includes(": 'today';")) {
  violations.push({
    area: 'admin usage overview page',
    file: 'apps/admin_web/app/usage-overview/usage-overview-model.ts',
    message: 'Usage overview page model must default to today.',
  });
}

const notificationTakeIsBounded =
  notificationListSource.includes('take: normalizeNotificationBoardTake(options.take),') ||
  (
    notificationListSource.includes('const take = normalizeNotificationBoardTake(options.take);') &&
    /const args:[\s\S]*?=\s*\{[\s\S]*?\btake,/.test(notificationListSource)
  );

if (!notificationTakeIsBounded) {
  violations.push({
    area: 'admin notification query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Notification board list must apply bounded server pagination.',
  });
}

if (!notificationListSource.includes('select: adminNotificationBoardListSelect,')) {
  violations.push({
    area: 'admin notification query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Notification board list must use the bounded notification select.',
  });
}

if (notificationListSource.includes('include:')) {
  violations.push({
    area: 'admin notification query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Notification board list must not use include; use bounded selects and detail/audit links.',
  });
}

if (!notificationSummarySource.includes('this.prisma.notification.count')) {
  violations.push({
    area: 'admin notification query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Notification board totals must use count queries instead of loading all rows.',
  });
}

if (!notificationSummarySource.includes('this.prisma.notificationDelivery.count')) {
  violations.push({
    area: 'admin notification query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Notification delivery totals must use count queries instead of loading all delivery rows.',
  });
}

if (!notificationPageModelSource.includes('const NOTIFICATION_API_TAKE = NOTIFICATION_TABLE_PAGE_SIZE;')) {
  violations.push({
    area: 'admin notification page',
    file: 'apps/admin_web/app/notifications/notification-page-model.ts',
    message: 'Notification page API calls must share the bounded table page size.',
  });
}

if (!notificationPageModelSource.includes('buildNotificationSummaryApiHref')) {
  violations.push({
    area: 'admin notification page',
    file: 'apps/admin_web/app/notifications/notification-page-model.ts',
    message: 'Notification page must keep a separate summary API href for aggregate counts.',
  });
}

if (!pushCampaignListSource.includes('take: normalizeAdminPushCampaignHistoryTake(options.take),')) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push campaign history must apply bounded server pagination.',
  });
}

if (pushCampaignListSource.includes('recipients:')) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push history must not hydrate recipient identifiers; use the bounded evidence endpoint.',
  });
}

if (!pushCampaignEvidenceSource.includes('take: 10,')) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push evidence must keep a bounded outcome-only recipient sample.',
  });
}

if (!pushCampaignSummarySource.includes('this.prisma.adminPushCampaign.aggregate')) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push campaign totals must use aggregate summary instead of loading all rows.',
  });
}

if (!pushCampaignAudienceSource.includes('this.prisma.user.count({ where: eligibleWhere })')) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push audience resolution must count role-and-locale eligible recipients separately.',
  });
}

if (
  !pushCampaignAudienceSource.includes('matchedUsers.slice(0, 5)') ||
  !pushCampaignAudienceSource.includes('take: NOTIFICATION_SEND_PUSH_DEVICE_LIMIT,')
) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push audience resolution must keep a five-account masked sample and a per-user device cap.',
  });
}

if (
  !pushCampaignPreviewSource.includes("status: 'PREVIEWED'") ||
  !pushCampaignPreviewSource.includes('ADMIN_PUSH_CAMPAIGN_PREVIEW_TTL_MS') ||
  !pushCampaignPreviewSource.includes('recipientFingerprint')
) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push preview must persist an expiring recipient fingerprint receipt.',
  });
}

if (
  !pushCampaignConfirmSource.includes('preview.recipientCount > ADMIN_PUSH_CAMPAIGN_RECIPIENT_LIMIT') ||
  !pushCampaignConfirmSource.includes('this.prisma.adminPushCampaign.updateMany({') ||
  !pushCampaignConfirmSource.includes('adminPushCampaignJob(preview.id)')
) {
  violations.push({
    area: 'admin push campaign query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Manual push confirmation must atomically consume a <=100 receipt and enqueue one campaign job.',
  });
}

if (!pushSendPageModelSource.includes('const PUSH_CAMPAIGN_API_TAKE = 20;')) {
  violations.push({
    area: 'admin push campaign page',
    file: 'apps/admin_web/app/notifications/push-send/push-send-page-model.ts',
    message: 'Push send page history API calls must keep a 20-row page size.',
  });
}

if (
  pushSendPageModelSource.includes("query.set('title'") ||
  pushSendPageModelSource.includes("query.set('body'") ||
  pushSendPageModelSource.includes("query.set('reason'") ||
  pushSendPageModelSource.includes("query.set('targetUserId'")
) {
  violations.push({
    area: 'admin push campaign page',
    file: 'apps/admin_web/app/notifications/push-send/push-send-page-model.ts',
    message: 'Push send URLs must not contain message copy, reason, or internal target identifiers.',
  });
}

if (
  !pushSendPageModelSource.includes('readSearchParam(params.campaignRange)') ||
  !pushSendPageModelSource.includes('readSearchParam(params.campaignPage)')
) {
  violations.push({
    area: 'admin push campaign page',
    file: 'apps/admin_web/app/notifications/push-send/push-send-page-model.ts',
    message: 'Push send URLs must remain limited to campaign history range and pagination state.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CUSTOMER_DIRECTORY_DEFAULT_LIMIT = 25;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer directory must keep a small default page size for first paint.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CUSTOMER_DIRECTORY_MAX_LIMIT = 100;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer directory must keep a hard maximum page size.',
  });
}

if (!adminCustomerSelectsSource.includes('export const ADMIN_CUSTOMER_DIRECTORY_BOOKING_LIMIT = 10;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin-customer-selects.ts',
    message: 'Customer list booking relations must keep a 10-row guard.',
  });
}

if (
  !customerDirectorySelectSource.includes('_count: { select: { selectedLocations: true } },') ||
  customerDirectorySelectSource.includes('selectedLocations: {')
) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin-customer-selects.ts',
    message: 'Customer list must count selected locations without hydrating location rows.',
  });
}

if (!adminCustomerSelectsSource.includes('export const ADMIN_CUSTOMER_DIRECTORY_SESSION_LIMIT = 1;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin-customer-selects.ts',
    message: 'Customer list app-session relations must keep a one-row latest-session guard.',
  });
}

if (!adminCustomerSelectsSource.includes('export const ADMIN_CUSTOMER_DIRECTORY_PUSH_DEVICE_LIMIT = 3;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin-customer-selects.ts',
    message: 'Customer list push-device relations must keep a 3-row guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CUSTOMER_LIST_AUDIT_LOG_LIMIT = 1;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list audit-log memo preview must keep a one-row per-customer guard.',
  });
}

if (!adminServiceSource.includes('take: adminCustomerDirectoryTake(options.take),')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list query must apply the bounded requested page size.',
  });
}

if (!adminServiceSource.includes('const skip = adminCustomerDirectorySkip(options.skip);')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list query must apply bounded server pagination offsets.',
  });
}

const customerDetailBookingLimitMatch = /export const ADMIN_CUSTOMER_DETAIL_BOOKING_LIMIT = (\d+);/.exec(
  adminCustomerSelectsSource,
);
const customerDetailBookingLimit = Number(customerDetailBookingLimitMatch?.[1] ?? Number.NaN);

if (!Number.isInteger(customerDetailBookingLimit) || customerDetailBookingLimit < 1 || customerDetailBookingLimit > 10) {
  violations.push({
    area: 'admin customer detail query',
    file: 'apps/api/src/admin/admin-customer-selects.ts',
    message: 'Customer detail booking relations must keep a bounded 1-10 row guard.',
  });
}

if (!adminCustomerSelectsSource.includes('take: ADMIN_CUSTOMER_DETAIL_BOOKING_LIMIT,')) {
  violations.push({
    area: 'admin customer detail query',
    file: 'apps/api/src/admin/admin-customer-selects.ts',
    message: 'Customer detail booking query must apply ADMIN_CUSTOMER_DETAIL_BOOKING_LIMIT.',
  });
}

if (
  !adminServiceSource.includes('take: customers.length * ADMIN_CUSTOMER_LIST_AUDIT_LOG_LIMIT,') &&
  !hasBoundedAuditSummaryHelper()
) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list audit-log query must cap rows by customer count and per-customer guard.',
  });
}

if (!hasAuditCountGroupBy('customerAuditCounts') && !hasAuditSummaryGroupByHelper()) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message:
      'Customer list must compute full audit-log memo counts separately from the latest memo preview rows.',
  });
}

if (!adminProviderGuardSource.includes('const ADMIN_PROVIDER_COMPACT_LIST_LIMIT = 50;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list query must keep the 50-row operations guard.',
  });
}

if (!adminProviderGuardSource.includes('const ADMIN_PROVIDER_COMPACT_BOOKING_RELATION_LIMIT = 15;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list booking relations must keep a 15-row guard.',
  });
}

if (!adminProviderGuardSource.includes('const ADMIN_PROVIDER_COMPACT_PARTICIPANT_RELATION_LIMIT = 15;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list participant relations must keep a 15-row guard.',
  });
}

if (!adminProviderGuardSource.includes('const ADMIN_PROVIDER_COMPACT_EARNING_RELATION_LIMIT = 10;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list earning relations must keep a 10-row guard.',
  });
}

if (!adminProviderGuardSource.includes('const ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT = 3;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list audit-log memo relations must keep a 3-row per-partner guard.',
  });
}

if (!providerListSource.includes('take: ADMIN_PROVIDER_COMPACT_LIST_LIMIT,')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list query must always apply ADMIN_PROVIDER_COMPACT_LIST_LIMIT.',
  });
}

if (!providerListSource.includes('select: adminProviderListSelect,')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list query must use the bounded adminProviderListSelect.',
  });
}

if (providerListSource.includes('include:')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message:
      'Partner list query must not use include; use bounded select fields and detail APIs for deep data.',
  });
}

if (providerListSource.includes('compact ?')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list query must not expose full/expanded fetch branches.',
  });
}

if (adminProviderGuardSource.includes('take: compact ? 100 : 100')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list must not load 100 nested booking or participant rows per partner.',
  });
}

if (
  !adminServiceSource.includes('take: providers.length * ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT,') &&
  !hasBoundedAuditSummaryHelper()
) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list audit-log query must cap rows by partner count and per-partner guard.',
  });
}

if (!hasAuditCountGroupBy('providerAuditCounts') && !hasAuditSummaryGroupByHelper()) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message:
      'Partner list must compute full audit-log memo counts separately from the latest memo preview rows.',
  });
}

for (const file of listFiles(adminWebAppRoot)) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
  const source = readFileSync(file, 'utf8');
  const providerListCalls = [
    ...source.matchAll(
      /adminGet<AdminProvider\[]>\(['"`](\/admin\/(?:partners|providers)(?!\/)[^'"`]*)['"`]/g,
    ),
  ];

  for (const call of providerListCalls) {
    const route = call[1];
    if (!route.includes('view=list')) {
      violations.push({
        area: 'admin provider query',
        file: relativePath(file),
        message: `Admin provider list calls must request compact view=list. Found ${route}.`,
      });
    }
  }
}

const result = {
  ok: violations.length === 0,
  purpose:
    'Static guard for Admin app session, notification, push campaign, customer, partner, usage overview, and chat query size.',
  violations,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  process.exit(1);
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function relativePath(path) {
  return path
    .replace(root, '')
    .replace(/^[/\\]/, '')
    .replaceAll('\\', '/');
}

function hasAuditCountGroupBy(resultName) {
  const escapedName = resultName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const directGroupBy = new RegExp(
    `const\\s+${escapedName}\\s*=\\s*await\\s+this\\.prisma\\.adminAuditLog\\.groupBy`,
  );
  const promiseAllGroupBy = new RegExp(
    `\\[[^\\]]*${escapedName}[^\\]]*\\]\\s*=\\s*await\\s+Promise\\.all\\(\\[[\\s\\S]*?this\\.prisma\\.adminAuditLog\\.groupBy`,
  );

  return directGroupBy.test(adminServiceSource) || promiseAllGroupBy.test(adminServiceSource);
}

function hasAuditSummaryGroupByHelper() {
  const helperSource = sourceBetween(
    'private async getAuditLogSummaryByTargets',
    'private async findRecentAuditLogsByTargets',
  );
  return (
    helperSource.includes('this.prisma.adminAuditLog.groupBy') && helperSource.includes("by: ['target']")
  );
}

function hasBoundedAuditSummaryHelper() {
  const helperSource = sourceBetween('private async findRecentAuditLogsByTargets', '\n}\n\nfunction toJson');
  return (
    helperSource.includes('ROW_NUMBER() OVER (PARTITION BY logs."target" ORDER BY logs."createdAt" DESC)') &&
    helperSource.includes('WHERE "targetRank" <= ${perTargetLimit}') &&
    helperSource.includes('LIMIT ${targets.length * perTargetLimit}')
  );
}
