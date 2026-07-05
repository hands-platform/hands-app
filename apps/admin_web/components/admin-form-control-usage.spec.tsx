import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

describe('Admin form control usage', () => {
  it('keeps legacy full tone button class names out of production TSX', () => {
    const offenders = ['app', 'components']
      .flatMap((directory) => listTsxFiles(join(process.cwd(), directory)))
      .filter((filePath) => !filePath.endsWith('.spec.tsx'))
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => legacyToneButtonClassNamePattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps shared form control button callers from passing the base button class twice', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRedundantSharedButtonBaseClass(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps native calendar input types inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => nativeCalendarInputTypePattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps visible text inputs inside shared Vuexy input atoms', () => {
    const allowedRawInputFiles = new Set(['components/admin-form-controls.tsx']);
    const offenders = productionTsxFiles()
      .filter((filePath) => !allowedRawInputFiles.has(relative(process.cwd(), filePath).replaceAll('\\', '/')))
      .filter((filePath) => visibleRawInputPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps inline alert copy inside shared Vuexy notice atoms', () => {
    const allowedNoticeFiles = new Set([
      'components/admin-inline-notice.tsx',
      'components/admin-surface.tsx',
    ]);
    const offenders = productionTsxFiles()
      .filter((filePath) => !allowedNoticeFiles.has(relative(process.cwd(), filePath).replaceAll('\\', '/')))
      .filter((filePath) => rawInlineNoticePattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps table scroll shells inside shared Vuexy table atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-data-table.tsx')
      .filter((filePath) => rawTableScrollPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps table footer shells inside shared Vuexy table atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-data-table.tsx')
      .filter((filePath) => rawTableFooterPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps literal pill chips inside shared Vuexy status badge atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/status-badge.tsx')
      .filter((filePath) => rawLiteralPillSpanPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps react-datepicker instances on the shared Vuexy calendar skin', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => readFileSync(filePath, 'utf8').includes('<DatePicker'))
      .filter((filePath) => !usesVuexyDatePickerSkin(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps legacy page field class names out of production form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => legacyPageFieldClassPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps generic form-grid class tokens inside the shared Vuexy form grid atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawGenericFormGridClassToken(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps drawer form grid class tokens inside the shared Vuexy drawer grid atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawDrawerFormGridClassToken(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps form action rows inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => rawFormActionRowPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps date filter width tweaks on the shared Vuexy form control token', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => readFileSync(filePath, 'utf8').includes('admin-date-filter-field'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps admin disclosure details inside shared Vuexy disclosure atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-surface.tsx')
      .filter((filePath) => rawAdminDisclosureDetailsPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps range segmented controls inside shared Vuexy segmented atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-segmented-control.tsx')
      .filter((filePath) => rawRangeSegmentedControlPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps directory filter form shells inside shared Vuexy directory filter atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-directory-filter-form.tsx')
      .filter((filePath) => rawDirectoryFilterFormPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps directory segmented filter buttons inside the shared Vuexy segmented atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-segmented-control.tsx')
      .filter((filePath) => rawDirectorySegmentedButtonsPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps review segmented filter buttons inside the shared Vuexy segmented atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-segmented-control.tsx')
      .filter((filePath) => rawReviewSegmentedButtonsPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps notification segmented filter buttons inside the shared Vuexy segmented atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-segmented-control.tsx')
      .filter((filePath) => rawNotificationSegmentedButtonsPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps booking monitor period filters inside the shared Vuexy segmented atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-segmented-control.tsx')
      .filter((filePath) => rawBookingMonitorSegmentedButtonsPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps finance filter chip rows inside the shared Vuexy chip group atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-filter-chip-group.tsx')
      .filter((filePath) => rawFinanceFilterChipRowPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps GET filter/search form shells inside the shared Vuexy form grid atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => rawGetFilterFormShellPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps inline admin action form shells inside the shared Vuexy inline action atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-inline-action-form.tsx')
      .filter((filePath) => rawAdminInlineActionFormPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps operator note form shells inside the shared Vuexy ops note atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-ops-note-form.tsx')
      .filter((filePath) => rawOpsNoteFormPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps legacy inline form shells inside the shared Vuexy inline form atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-inline-action-form.tsx')
      .filter((filePath) => hasRawInlineFormClassToken(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps finance inline action forms inside the shared Vuexy inline action atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-inline-action-form.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'inline-admin-action-form'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps row action form shells inside the shared Vuexy action form atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-inline-action-form.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'actions'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps operator permission row forms inside the shared Vuexy inline action atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-inline-action-form.tsx')
      .filter((filePath) => {
        const source = readFileSync(filePath, 'utf8');
        return (
          hasRawFormClassToken(source, 'admin-operator-inline-form') ||
          hasRawFormClassToken(source, 'admin-operator-inline-delete-form')
        );
      })
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps coupon edit forms inside the shared Vuexy form shell atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'coupon-edit-form'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps push send confirmation forms inside the shared Vuexy form shell atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'notification-push-send-confirm-form'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps participant list action forms inside the shared Vuexy form shell atom', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'participant-list'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps compact command forms inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'compact-form'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps booking date range forms inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'booking-custom-date-grid'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps bank reconciliation reverse forms inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'finance-reconciliation-reverse-form'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps referral reward dropdown action forms inside shared Vuexy action menu atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/action-menu.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'referral-reward-action-form'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps earnings action forms inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => rawEarningsActionFormPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps booking post-match decision forms inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => rawBookingPostMatchDecisionFormPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps booking preset note and task forms inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => rawBookingPresetActionFormPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps notification template copy forms inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'notification-template-copy-form'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps referral policy forms inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'referral-policy-form'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps admin auth forms inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/') !== 'components/admin-form-controls.tsx')
      .filter((filePath) => hasRawFormClassToken(readFileSync(filePath, 'utf8'), 'admin-auth-form'))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps admin logout forms inside shared Vuexy form atoms', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => rawAdminLogoutFormPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });

  it('keeps page-local article tags out of production TSX surfaces', () => {
    const offenders = productionTsxFiles()
      .filter((filePath) => rawArticleTagPattern.test(readFileSync(filePath, 'utf8')))
      .map((filePath) => relative(process.cwd(), filePath).replaceAll('\\', '/'));

    expect(offenders).toEqual([]);
  });
});

const legacyToneButtonClassNamePattern =
  /className="[^"]*\bbutton\s+button-(?:danger|info|outline|primary|secondary|success)\b/;
const sharedFormButtonClassNamePattern =
  /<AdminFormControl(?:Button|Link)\b[^>]*className=(["'])(?<className>.*?)\1/gs;
const nativeCalendarInputTypePattern = /<input\b[^>]*\btype=["'](?:date|datetime-local|month|time)["']/;
const visibleRawInputPattern = /<input\b(?![^>]*\btype=["']hidden["'])/s;
const rawInlineNoticePattern =
  /className=["'][^"']*(?:admin-form-error|form-error|calendar-readonly-alert|admin-auth-error)[^"']*["']/;
const rawTableScrollPattern = /<div\s+className=["']admin-table-scroll["']/;
const rawTableFooterPattern = /<div\s+className=["'][^"']*\bvuexy-booking-table-footer\b[^"']*["']/;
const rawLiteralPillSpanPattern = /<span\s+className=["'][^"']*\bpill(?:\s|-)[^"']*["']/;
const rawAdminDisclosureDetailsPattern = /<details\b[^>]*className=(?:"[^"]*\badmin-disclosure\b[^"]*"|'[^']*\badmin-disclosure\b[^']*'|\{`[^`]*\badmin-disclosure\b[^`]*`\})/s;
const rawRangeSegmentedControlPattern =
  /<div\b[^>]*className=(?:"[^"]*\bbooking-date-filter-buttons\b[^"]*\b(?:usage-overview|vietnam-overview)-range-buttons\b[^"]*"|'[^']*\bbooking-date-filter-buttons\b[^']*\b(?:usage-overview|vietnam-overview)-range-buttons\b[^']*')/s;
const rawDirectoryFilterFormPattern =
  /<form\b[^>]*className=(?:"[^"]*\badmin-directory-filter-form\b[^"]*"|'[^']*\badmin-directory-filter-form\b[^']*')/s;
const rawDirectorySegmentedButtonsPattern =
  /<div\b[^>]*className=(?:"[^"]*\bbooking-date-filter-buttons\b[^"]*\b(?:vuexy-customer-date-buttons|vuexy-partner-filter-buttons|referral-reward-filter-buttons)\b[^"]*"|'[^']*\bbooking-date-filter-buttons\b[^']*\b(?:vuexy-customer-date-buttons|vuexy-partner-filter-buttons|referral-reward-filter-buttons)\b[^']*')/s;
const rawReviewSegmentedButtonsPattern =
  /<div\b[^>]*className=(?:"[^"]*\bbooking-date-filter-buttons\b[^"]*\b(?:vuexy-review-date-buttons|vuexy-review-sort-buttons)\b[^"]*"|'[^']*\bbooking-date-filter-buttons\b[^']*\b(?:vuexy-review-date-buttons|vuexy-review-sort-buttons)\b[^']*')/s;
const rawNotificationSegmentedButtonsPattern =
  /<div\b[^>]*className=(?:"[^"]*\bbooking-date-filter-buttons\b[^"]*\b(?:notification-date-filter-buttons|notification-push-campaign-range-row)\b[^"]*"|'[^']*\bbooking-date-filter-buttons\b[^']*\b(?:notification-date-filter-buttons|notification-push-campaign-range-row)\b[^']*')/s;
const rawBookingMonitorSegmentedButtonsPattern =
  /<div\b[^>]*className=(?:"booking-date-filter-buttons"|'booking-date-filter-buttons')[^>]*aria-label=(?:"Booking list period"|'Booking list period')/s;
const rawFinanceFilterChipRowPattern =
  /<div\b[^>]*className=(?:"filter-row admin-mt-12"|'filter-row admin-mt-12')/s;
const rawFormActionRowPattern =
  /<div\b[^>]*className=(?:"[^"]*\b(?:form-actions|finance-reconciliation-form-actions|actions full-span)\b[^"]*"|'[^']*\b(?:form-actions|finance-reconciliation-form-actions|actions full-span)\b[^']*')/s;
const rawGetFilterFormShellPattern =
  /<form\b[^>]*className=(?:"(?:inline-form admin-mt-12|admin-filter-form|notification-push-preview-form|vuexy-review-controls)"|'(?:inline-form admin-mt-12|admin-filter-form|notification-push-preview-form|vuexy-review-controls)')/s;
const rawAdminInlineActionFormPattern =
  /<form\b[^>]*className=(?:"admin-inline-form"|'admin-inline-form')/s;
const rawOpsNoteFormPattern =
  /<form\b[^>]*className=(?:"[^"]*\bops-note-form\b[^"]*"|'[^']*\bops-note-form\b[^']*')/s;
const rawEarningsActionFormPattern = /<form\b[^>]*action=(?:"\/earnings"|'\/earnings')/s;
const rawBookingPostMatchDecisionFormPattern =
  /<form\b[^>]*action=\{(?:approvePostMatchCancellationFromDetail|holdPostMatchCancellationFromDetail)\}/s;
const rawBookingPresetActionFormPattern =
  /<form\b[^>]*action=\{(?:addBookingOpsNote|updateBookingOpsTask)\}/s;
const rawAdminLogoutFormPattern = /<form\b[^>]*action=(?:"\/api\/admin\/session\/logout"|'\/api\/admin\/session\/logout')/s;
const rawArticleTagPattern = /<\/?article\b/;
const legacyPageFieldClassPattern =
  /className=(["'])(?:(?:(?!\1).)*\s)?(?:calendar-drawer-field|calendar-field|field)(?:\s(?:(?!\1).)*)?\1/s;
const rawClassNamePattern = /className=(["'])(?<className>.*?)\1/gs;
const formTagPattern = /<form\b[^>]*className=(["'])(?<className>.*?)\1/gs;

function productionTsxFiles() {
  return ['app', 'components']
    .flatMap((directory) => listTsxFiles(join(process.cwd(), directory)))
    .filter((filePath) => !filePath.endsWith('.spec.tsx'));
}

function usesVuexyDatePickerSkin(source: string) {
  const datePickerCount = source.match(/<DatePicker\b/g)?.length ?? 0;
  const vuexySkinCount = source.match(/calendarClassName="[^"]*\bcalendar-vuexy-datepicker\b/g)?.length ?? 0;
  return datePickerCount === vuexySkinCount;
}

function hasRedundantSharedButtonBaseClass(source: string) {
  for (const match of source.matchAll(sharedFormButtonClassNamePattern)) {
    const className = match.groups?.className ?? '';
    if (className.split(/\s+/).includes('button')) {
      return true;
    }
  }
  return false;
}

function hasRawGenericFormGridClassToken(source: string) {
  for (const match of source.matchAll(rawClassNamePattern)) {
    const className = match.groups?.className ?? '';
    if (className.split(/\s+/).includes('form-grid')) {
      return true;
    }
  }
  return false;
}

function hasRawDrawerFormGridClassToken(source: string) {
  for (const match of source.matchAll(rawClassNamePattern)) {
    const className = match.groups?.className ?? '';
    if (className.split(/\s+/).includes('calendar-form-grid')) {
      return true;
    }
  }
  return false;
}

function hasRawInlineFormClassToken(source: string) {
  return hasRawFormClassToken(source, 'inline-form');
}

function hasRawFormClassToken(source: string, token: string) {
  for (const match of source.matchAll(formTagPattern)) {
    const className = match.groups?.className ?? '';
    if (className.split(/\s+/).includes(token)) {
      return true;
    }
  }
  return false;
}

function listTsxFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory).flatMap((entry) => {
    const filePath = join(directory, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      return listTsxFiles(filePath);
    }
    return filePath.endsWith('.tsx') ? [filePath] : [];
  });
}
