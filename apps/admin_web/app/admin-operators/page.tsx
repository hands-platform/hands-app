import Link from 'next/link';
import { History, KeyRound, RefreshCw, Shield, UserPlus, Users } from 'lucide-react';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminDirectoryFilterForm } from '../../components/admin-directory-filter-form';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import { AdminCard, AdminNoticeCard, AdminSection } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import { adminGetResult } from '../../lib/admin-api';
import { getCurrentAdminOperatorAccessResult } from '../../lib/admin-operator-access';
import {
  FINANCE_APPROVER_ROLE,
  MASTER_ADMIN_ROLE,
  adminOperatorPermissionCategoryDefinitions,
  expandLegacyAdminOperatorCategories,
} from '../../lib/admin-operator-permissions';
import { OperatorAccessDrawer } from './operator-access-drawer';
import { formatOperatorCount, operatorHistoryActorLabel } from './operator-copy';
import { OperatorInvitationsDisclosure } from './operator-invitations-disclosure';
import { AdminMfaEnrollmentForm } from './admin-mfa-enrollment-form';
import {
  InviteOperatorForm,
  InitializeOperatorPermissionForm,
  InvitationActionForm,
  OperatorAccessForm,
  OffboardOperatorForm,
  OperatorStatusForm,
  ReauthenticateOperatorForm,
  ResetAdminMfaForm,
  SessionRevokeForm,
} from './operator-access-forms';

type PageParams = {
  readonly category?: string;
  readonly cursor?: string;
  readonly cursorHistory?: string;
  readonly historyCursor?: string;
  readonly historyCursorHistory?: string;
  readonly existingEmail?: string;
  readonly invite?: string;
  readonly operatorId?: string;
  readonly q?: string;
  readonly role?: string;
  readonly status?: string;
  readonly tab?: string;
};

type OperatorDirectoryItem = {
  readonly allowedActions: {
    readonly initializeAccess: OperatorActionDecision;
    readonly reactivate: OperatorActionDecision;
    readonly revokeOperatorAccess: OperatorActionDecision;
    readonly revokeSession: OperatorActionDecision;
    readonly suspend: OperatorActionDecision;
    readonly updateAccess: OperatorActionDecision;
  };
  readonly activeSessionCount: number;
  readonly createdAt: string;
  readonly credential: null | {
    readonly disabledAt: string | null;
    readonly disabledReason: string | null;
    readonly failedLoginCount: number;
    readonly lastLoginAt: string | null;
    readonly lockedUntil: string | null;
    readonly mfaState: string;
    readonly passwordUpdatedAt: string;
    readonly setupCompletedAt: string | null;
  };
  readonly email: string | null;
  readonly fullName: string | null;
  readonly id: string;
  readonly lastSession: null | {
    readonly expiresAt: string;
    readonly id: string;
    readonly lastSeenAt: string;
    readonly platformSummary: string | null;
    readonly revokedAt: string | null;
  };
  readonly lifecycleStatus: 'ACTIVE' | 'LOCKED' | 'MIGRATION_REQUIRED' | 'SETUP_REQUIRED' | 'SUSPENDED';
  readonly permission: null | {
    readonly categories: string[];
    readonly effectiveCategories: string[];
    readonly effectiveLeafPermissionCount: number;
    readonly id: string;
    readonly storedPermissionCount: number;
    readonly updatedAt: string;
    readonly version: number;
  };
  readonly phone: string;
  readonly roles: string[];
  readonly updatedAt: string;
};

type OperatorActionDecision = {
  readonly allowed: boolean;
  readonly blockedReasons: ReadonlyArray<{ readonly code: string; readonly message: string }>;
};

type OperatorDirectory = {
  readonly items: OperatorDirectoryItem[];
  readonly page: {
    readonly filteredTotal: number;
    readonly hasNextPage: boolean;
    readonly nextCursor: string | null;
    readonly returned: number;
  };
  readonly summary: {
    readonly finance: number;
    readonly locked: number;
    readonly master: number;
    readonly missingCredential: number;
    readonly missingPermission: number;
    readonly mfaNotConfigured: number;
    readonly securityIncompleteDistinct: number;
    readonly suspended: number;
    readonly total: number;
  };
};

type CurrentMfa = {
  readonly enrolledAt: string | null;
  readonly recoveryCodesRemaining: number;
  readonly state: string;
};

type InvitationDirectory = {
  readonly expiredCount: number;
  readonly items: Array<{
    readonly acceptedAt: string | null;
    readonly createdAt: string;
    readonly expiresAt: string;
    readonly fullName: string | null;
    readonly id: string;
    readonly normalizedEmail: string;
    readonly revokedAt: string | null;
    readonly status: 'ACCEPTED' | 'EXPIRED' | 'PENDING' | 'REVOKED';
    readonly deliveryStatus: 'ACCEPTED' | 'EXPIRED' | 'PENDING' | 'REVOKED';
  }>;
  readonly pendingCount: number;
  readonly totalCount: number;
};

type OperatorSession = {
  readonly current: boolean;
  readonly expiresAt: string;
  readonly id: string;
  readonly issuedAt: string;
  readonly lastSeenAt: string;
  readonly platformSummary: string | null;
  readonly reauthenticatedAt: string | null;
  readonly revokedAt: string | null;
  readonly revocationReason: string | null;
};

type OperatorHistory = {
  readonly items: Array<{
    readonly action: string;
    readonly actor: null | { readonly email: string | null; readonly fullName: string | null; readonly id: string };
    readonly createdAt: string;
    readonly id: string;
    readonly metadata: unknown;
    readonly target: string;
  }>;
  readonly page: {
    readonly hasNextPage: boolean;
    readonly nextCursor: string | null;
    readonly returned: number;
  };
  readonly totalCount: number;
};

type ExistingUserCandidateResult = {
  readonly blockers?: ReadonlyArray<{ readonly code: string; readonly message: string }>;
  readonly candidate: null | {
    readonly email: string | null;
    readonly fullName: string | null;
    readonly id: string;
    readonly permissionPresent: boolean;
    readonly provenance: string | null;
    readonly roles: string[];
  };
  readonly matchCount: number;
  readonly normalizedEmail: string;
  readonly status: 'AMBIGUOUS' | 'ELIGIBLE' | 'INELIGIBLE' | 'NO_MATCH';
};

const EMPTY_DIRECTORY: OperatorDirectory = {
  items: [],
  page: { filteredTotal: 0, hasNextPage: false, nextCursor: null, returned: 0 },
  summary: {
    finance: 0,
    locked: 0,
    master: 0,
    missingCredential: 0,
    missingPermission: 0,
    mfaNotConfigured: 0,
    securityIncompleteDistinct: 0,
    suspended: 0,
    total: 0,
  },
};
const EMPTY_INVITATIONS: InvitationDirectory = { expiredCount: 0, items: [], pendingCount: 0, totalCount: 0 };
const EMPTY_HISTORY: OperatorHistory = {
  items: [],
  page: { hasNextPage: false, nextCursor: null, returned: 0 },
  totalCount: 0,
};
const EMPTY_EXISTING_USER_CANDIDATE: ExistingUserCandidateResult = {
  candidate: null,
  matchCount: 0,
  normalizedEmail: '',
  status: 'NO_MATCH',
};
const ACCESS_DOMAIN_GROUP_ORDER = [
  'Bookings',
  'Users',
  'Partners',
  'Finance',
  'Tax & Accounting',
  'Growth & Communications',
  'Policies',
  'Admin Control',
  'Website Content',
  'Developer / System',
] as const;
const ACCESS_DOMAIN_OPTIONS = [...adminOperatorPermissionCategoryDefinitions]
  .sort((left, right) => {
    const groupDifference =
      ACCESS_DOMAIN_GROUP_ORDER.indexOf(left.group as (typeof ACCESS_DOMAIN_GROUP_ORDER)[number]) -
      ACCESS_DOMAIN_GROUP_ORDER.indexOf(right.group as (typeof ACCESS_DOMAIN_GROUP_ORDER)[number]);
    return groupDifference || left.label.localeCompare(right.label);
  })
  .map((definition) => ({
    label: `${definition.group} — ${definition.label}`,
    value: definition.key,
  }));

export default async function AdminOperatorsPage({ searchParams }: { readonly searchParams?: Promise<PageParams> }) {
  const params = searchParams ? await searchParams : {};
  const currentAccessPromise = getCurrentAdminOperatorAccessResult();
  const currentMfaPromise = adminGetResult<CurrentMfa>('/admin/admin-operators/me/mfa', {
    enrolledAt: null,
    recoveryCodesRemaining: 0,
    state: 'UNAVAILABLE',
  });
  const directoryPath = `/admin/users/admin-operators?${directoryQuery(params)}`;
  const directoryPromise = adminGetResult<OperatorDirectory>(directoryPath, EMPTY_DIRECTORY);
  const selectedPromise = params.operatorId
    ? adminGetResult<OperatorDirectoryItem | null>(
        `/admin/users/admin-operators/${encodeURIComponent(params.operatorId)}`,
        null,
      )
    : Promise.resolve({ data: null, ok: true, status: 200 } as const);
  const currentAccessResult = await currentAccessPromise;
  const currentAccess = currentAccessResult.data;
  const isMaster = Boolean(currentAccess?.roles.includes(MASTER_ADMIN_ROLE));
  const invitationsPromise = isMaster
    ? adminGetResult<InvitationDirectory>('/admin/admin-operator-invitations', EMPTY_INVITATIONS)
    : Promise.resolve({ data: EMPTY_INVITATIONS, ok: true, status: 200 } as const);
  const sessionsPromise = isMaster && params.operatorId
    ? adminGetResult<OperatorSession[]>(
        `/admin/users/${encodeURIComponent(params.operatorId)}/admin-web-sessions`,
        [],
      )
    : Promise.resolve({ data: [] as OperatorSession[], ok: true, status: 200 });
  const historyPromise = isMaster && params.operatorId
    ? adminGetResult<OperatorHistory>(
        `/admin/admin-operator-history?targetUserId=${encodeURIComponent(params.operatorId)}&take=30${params.historyCursor ? `&cursor=${encodeURIComponent(params.historyCursor)}` : ''}`,
        EMPTY_HISTORY,
      )
    : Promise.resolve({ data: EMPTY_HISTORY, ok: true, status: 200 });
  const existingUserCandidatePromise = isMaster && params.invite === 'existing' && params.existingEmail
    ? adminGetResult<ExistingUserCandidateResult>(
        `/admin/admin-operator-invitations/existing-user-candidate?email=${encodeURIComponent(params.existingEmail)}`,
        EMPTY_EXISTING_USER_CANDIDATE,
      )
    : Promise.resolve({ data: EMPTY_EXISTING_USER_CANDIDATE, ok: true, status: 200 });
  const [
    currentMfaResult,
    directoryResult,
    invitationsResult,
    selectedResult,
    sessionsResult,
    historyResult,
    existingUserCandidateResult,
  ] = await Promise.all([
    currentMfaPromise,
    directoryPromise,
    invitationsPromise,
    selectedPromise,
    sessionsPromise,
    historyPromise,
    existingUserCandidatePromise,
  ]);

  const directory = directoryResult.data;
  const invitations = invitationsResult.data;
  const selectedOperator = selectedResult.data;
  const closeHref = operatorAccessHref(params, {
    existingEmail: undefined,
    historyCursor: undefined,
    historyCursorHistory: undefined,
    invite: undefined,
    operatorId: undefined,
    tab: undefined,
  });
  return (
    <AdminPageTemplate
      actions={(
        <>
          <AdminFormControlLink className="button-secondary" href={operatorAccessHref(params, { cursor: undefined })}>
            <RefreshCw aria-hidden="true" size={15} /> Refresh now
          </AdminFormControlLink>
          {isMaster ? (
            <AdminFormControlLink className="button-primary" href={operatorAccessHref(params, { invite: '1', operatorId: undefined, tab: undefined })}>
              <UserPlus aria-hidden="true" size={15} /> Invite operator
            </AdminFormControlLink>
          ) : null}
        </>
      )}
      contentClassName="operator-access-page"
      description="Invite operators, review effective access, and suspend Admin Web access."
      title="Admin operators"
    >
      {!currentAccessResult.ok ? <LoadFailure label="Your current operator access could not be verified." /> : null}
      {currentAccess && !isMaster ? (
        <AdminInlineNotice role="status" tone="info">
          <Shield aria-hidden="true" size={17} />
          <span><strong>View-only access.</strong> Master Admin access is required to invite operators or change Admin Web access.</span>
        </AdminInlineNotice>
      ) : null}
      {directory.summary.missingPermission > 0 ? (
        <AdminNoticeCard className="operator-access-risk-notice" tone="warning">
          <strong>Permission setup required</strong>
          <p>{formatOperatorCount(directory.summary.missingPermission, 'Admin operator')} {directory.summary.missingPermission === 1 ? 'has' : 'have'} no explicit permission record. They remain deny-by-default until migrated.</p>
          <StatusBadge tone="warning">Migration required</StatusBadge>
        </AdminNoticeCard>
      ) : null}
      {currentMfaResult.ok ? (
        <AdminMfaEnrollmentForm {...currentMfaResult.data} />
      ) : (
        <AdminNoticeCard className="operator-access-mfa-notice" tone="danger">
          <strong>MFA status unavailable</strong>
          <p>Do not perform high-risk Admin or Finance actions until MFA status can be verified.</p>
          <StatusBadge tone="danger">Fail closed</StatusBadge>
        </AdminNoticeCard>
      )}

      {directoryResult.ok ? (
        <nav aria-label="Admin operator command summary" className="operator-access-command-strip">
          <CommandLink href="/admin-operators" label="All operators" value={directory.summary.total} />
          <CommandLink href="/admin-operators?status=needs-action" label="Needs action" tone="warning" value={directory.summary.securityIncompleteDistinct} />
          <CommandLink href="/admin-operators#invitations" label="Pending invitations" tone="warning" value={invitations.pendingCount} />
          <CommandLink href="/admin-operators?status=locked" label="Locked" tone="danger" value={directory.summary.locked} />
          <span className="operator-access-command-breakdown">
            Permission missing {directory.summary.missingPermission} · Sign-in missing {directory.summary.missingCredential} · Operators missing MFA {directory.summary.mfaNotConfigured}
          </span>
        </nav>
      ) : <LoadFailure label="The operator summary could not be loaded." />}

      <AdminSection className="operator-access-directory-section" title="Operator directory">
        <AdminSectionHeader
          description="Active, setup-required, suspended, and locked Admin Web operators from the exact server directory."
          status={<StatusBadge tone={directoryResult.ok ? 'info' : 'danger'}>{directoryResult.ok ? formatOperatorCount(directory.page.filteredTotal, 'result') : 'Unavailable'}</StatusBadge>}
          title="Find an operator"
        />
        <AdminDirectoryFilterForm action="/admin-operators" className="operator-access-filter-bar" method="get">
          <AdminFormSearch defaultValue={params.q} label="Search name or admin email" name="q" placeholder="Name, email, or operator ID" />
          <AdminFormSelect
            defaultValue={params.status ?? ''}
            label="Status"
            name="status"
            options={[
              { label: 'All statuses', value: '' },
              { label: 'Needs action', value: 'needs-action' },
              { label: 'Active', value: 'active' },
              { label: 'Setup required', value: 'setup-required' },
              { label: 'Migration required', value: 'migration-required' },
              { label: 'Suspended', value: 'suspended' },
              { label: 'Locked', value: 'locked' },
              { label: 'MFA required', value: 'mfa-required' },
            ]}
          />
          <AdminFormSelect
            defaultValue={params.role ?? ''}
            label="Role"
            name="role"
            options={[
              { label: 'All roles', value: '' },
              { label: 'Admin', value: 'ADMIN' },
              { label: 'Master Admin', value: MASTER_ADMIN_ROLE },
              { label: 'Finance Approver', value: FINANCE_APPROVER_ROLE },
            ]}
          />
          <AdminFormSelect
            defaultValue={params.category ?? ''}
            label="Access domain"
            name="category"
            options={[
              { label: 'All domains', value: '' },
              ...ACCESS_DOMAIN_OPTIONS,
            ]}
          />
          <AdminFormControlButton className="button-primary" type="submit">Apply filters</AdminFormControlButton>
          <AdminFormControlLink className="button-secondary" href="/admin-operators">Reset</AdminFormControlLink>
        </AdminDirectoryFilterForm>
      </AdminSection>

      {directoryResult.ok ? (
        <AdminTablePanel
          description={directory.page.filteredTotal === 0 && hasDirectoryFilters(params)
            ? 'No operators match the current filters.'
            : 'Select one operator to review direct access, sessions, and exact lifecycle history.'}
          resultLabel={`${directory.page.returned} shown · ${directory.page.filteredTotal} total`}
          resultTone="info"
          title="Admin Web operators"
        >
          <AdminTableScroll ariaLabel="Operator Access directory">
            <AdminDataTable
              className="vuexy-booking-table operator-access-table"
              emptyMessage={hasDirectoryFilters(params) ? 'No operators match these filters.' : 'No Admin operators exist.'}
              headers={['Operator', 'Status', 'Roles', 'Effective access', 'Security', 'Last sign-in', 'Action']}
              rowCount={directory.items.length}
            >
              {directory.items.map((operator) => (
                <OperatorRow currentUserId={currentAccess?.id} key={operator.id} operator={operator} params={params} />
              ))}
            </AdminDataTable>
          </AdminTableScroll>
          {directory.page.hasNextPage && directory.page.nextCursor ? (
            <div className="operator-access-pagination">
              <span className="muted">Showing {directory.page.returned} records on this page · {directory.page.filteredTotal} total</span>
              {params.cursor ? (
                <>
                  <AdminFormControlLink className="button-secondary" href={operatorAccessHref(params, { cursor: undefined, cursorHistory: undefined })}>
                    First
                  </AdminFormControlLink>
                  <AdminFormControlLink className="button-secondary" href={previousPageHref(params)}>
                    Previous
                  </AdminFormControlLink>
                </>
              ) : null}
              <AdminFormControlLink className="button-secondary" href={operatorAccessHref(params, { cursor: directory.page.nextCursor })}>
                Next page
              </AdminFormControlLink>
            </div>
          ) : params.cursor ? (
            <div className="operator-access-pagination">
              <span className="muted">Last page · {directory.page.filteredTotal} total</span>
              <AdminFormControlLink className="button-secondary" href={operatorAccessHref(params, { cursor: undefined, cursorHistory: undefined })}>First</AdminFormControlLink>
              <AdminFormControlLink className="button-secondary" href={previousPageHref(params)}>Previous</AdminFormControlLink>
            </div>
          ) : null}
        </AdminTablePanel>
      ) : <LoadFailure label="Operator records could not be loaded. Retry before making access decisions." />}

      {isMaster ? (
        <AdminCard className="operator-access-invitations" id="invitations">
          <OperatorInvitationsDisclosure pendingCount={invitations.pendingCount}>
            {!invitationsResult.ok ? <LoadFailure label="Invitation records could not be loaded." /> : (
              <div className="operator-access-invitation-list">
                <ReauthenticateOperatorForm />
                {invitations.pendingCount === 0 ? (
                  <AdminInlineNotice role="status" tone="info">
                    <span><strong>No pending invitations.</strong> Create a one-time invitation when another operator needs Admin Web access.</span>
                    <AdminFormControlLink className="button-secondary" href={operatorAccessHref(params, { invite: '1', operatorId: undefined, tab: undefined })}>
                      Invite operator
                    </AdminFormControlLink>
                  </AdminInlineNotice>
                ) : null}
                {invitations.items.length ? invitations.items.map((invitation) => (
                  <div key={invitation.id}>
                    <span><strong>{invitation.fullName ?? invitation.normalizedEmail}</strong><small>{invitation.normalizedEmail}</small></span>
                    <StatusBadge tone={invitation.status === 'PENDING' ? 'warning' : invitation.status === 'ACCEPTED' ? 'success' : 'neutral'}>{invitation.status}</StatusBadge>
                    <DateTimeText value={invitation.expiresAt} />
                    {invitation.status === 'PENDING' || invitation.status === 'EXPIRED' ? (
                      <div className="operator-access-invitation-actions">
                        {invitation.status === 'PENDING' ? (
                          <InvitationActionForm invitationId={invitation.id} mode="revoke" operatorName={invitation.fullName ?? invitation.normalizedEmail} />
                        ) : null}
                        <InvitationActionForm invitationId={invitation.id} mode="resend" operatorName={invitation.fullName ?? invitation.normalizedEmail} />
                      </div>
                    ) : null}
                  </div>
                )) : null}
              </div>
            )}
          </OperatorInvitationsDisclosure>
        </AdminCard>
      ) : null}

      {params.invite === '1' && isMaster ? (
        <OperatorAccessDrawer returnHref={closeHref} title="Invite operator">
          <InviteModeNavigation params={params} selected="new" />
          <p className="muted">Create a short-lived, one-time setup link. No temporary password is stored or sent.</p>
          <ReauthenticateOperatorForm />
          <InviteOperatorForm />
        </OperatorAccessDrawer>
      ) : null}

      {params.invite === 'existing' && isMaster ? (
        <OperatorAccessDrawer returnHref={closeHref} title="Grant Admin access to existing user">
          <InviteModeNavigation params={params} selected="existing" />
          <p className="muted">Find one exact existing User by email, verify the identity, then create a linked one-time setup invitation.</p>
          <form action="/admin-operators" className="operator-access-existing-user-search" method="get">
            <input name="invite" type="hidden" value="existing" />
            <AdminFormSearch
              defaultValue={params.existingEmail}
              label="Exact existing user email"
              labelVisibility="visible"
              maxLength={160}
              name="existingEmail"
              placeholder="person@example.com"
            />
            <AdminFormControlButton className="button-secondary" type="submit">Find exact user</AdminFormControlButton>
          </form>
          {!params.existingEmail ? (
            <AdminInlineNotice role="note" tone="info">
              Enter the exact email. Partial or broad directory search is intentionally unavailable.
            </AdminInlineNotice>
          ) : !existingUserCandidateResult.ok ? (
            <LoadFailure label="The existing-user identity check could not be completed." />
          ) : existingUserCandidateResult.data.status === 'NO_MATCH' ? (
            <AdminInlineNotice role="status" tone="info">
              <span>No existing User has the exact email <strong>{existingUserCandidateResult.data.normalizedEmail}</strong>.</span>
              <AdminFormControlLink className="button-secondary" href={operatorAccessHref(params, { existingEmail: undefined, invite: '1' })}>
                Invite a new operator
              </AdminFormControlLink>
            </AdminInlineNotice>
          ) : existingUserCandidateResult.data.status === 'AMBIGUOUS' ? (
            <AdminInlineNotice role="alert" tone="danger">
              <span><strong>Identity is ambiguous.</strong> {formatOperatorCount(existingUserCandidateResult.data.matchCount, 'User')} share this exact email. Resolve the duplicate identities before granting Admin access.</span>
            </AdminInlineNotice>
          ) : existingUserCandidateResult.data.status === 'INELIGIBLE' ? (
            <AdminInlineNotice role="alert" tone="warning">
              <span><strong>This User is not eligible.</strong> {existingUserCandidateResult.data.blockers?.map((blocker) => blocker.message).join(' ')}</span>
            </AdminInlineNotice>
          ) : existingUserCandidateResult.data.candidate ? (
            <>
              <AdminCard className="operator-access-existing-user-candidate">
                <span><strong>{existingUserCandidateResult.data.candidate.fullName ?? existingUserCandidateResult.data.candidate.email ?? existingUserCandidateResult.data.candidate.id}</strong><small>{existingUserCandidateResult.data.candidate.email}</small></span>
                <span><small>Exact User ID</small><code>{existingUserCandidateResult.data.candidate.id}</code></span>
                <RoleBadges roles={existingUserCandidateResult.data.candidate.roles} />
                <StatusBadge tone="success">Verified exact match</StatusBadge>
              </AdminCard>
              <ReauthenticateOperatorForm />
              <InviteOperatorForm targetUser={existingUserCandidateResult.data.candidate} />
            </>
          ) : null}
        </OperatorAccessDrawer>
      ) : null}

      {params.operatorId ? (
        <OperatorAccessDrawer
          returnFocusHref={operatorAccessHref(params, { operatorId: params.operatorId, tab: undefined })}
          returnHref={closeHref}
          title={selectedOperator ? operatorIdentity(selectedOperator) : 'Operator detail'}
        >
          {!selectedResult.ok || !selectedOperator ? <LoadFailure label="This operator detail could not be loaded." /> : (
            <OperatorDetail
              currentUserId={currentAccess?.id}
              history={historyResult.data}
              historyOk={historyResult.ok}
              isMaster={isMaster}
              operator={selectedOperator}
              params={params}
              sessions={sessionsResult.data}
              sessionsOk={sessionsResult.ok}
            />
          )}
        </OperatorAccessDrawer>
      ) : null}
    </AdminPageTemplate>
  );
}

function InviteModeNavigation({
  params,
  selected,
}: {
  readonly params: PageParams;
  readonly selected: 'existing' | 'new';
}) {
  return (
    <nav aria-label="Operator invitation type" className="operator-access-tabs">
      <Link
        aria-current={selected === 'new' ? 'page' : undefined}
        href={operatorAccessHref(params, { existingEmail: undefined, invite: '1' })}
        prefetch={false}
        scroll={false}
      >
        Invite new operator
      </Link>
      <Link
        aria-current={selected === 'existing' ? 'page' : undefined}
        href={operatorAccessHref(params, { existingEmail: undefined, invite: 'existing' })}
        prefetch={false}
        scroll={false}
      >
        Grant existing user Admin access
      </Link>
    </nav>
  );
}

function OperatorRow({ currentUserId, operator, params }: { readonly currentUserId?: string; readonly operator: OperatorDirectoryItem; readonly params: PageParams }) {
  const accessGroups = operatorAccessGroups(operator);
  return (
    <tr>
      <td>
        <strong>{operatorIdentity(operator)} {operator.id === currentUserId ? <StatusBadge tone="primary">You</StatusBadge> : null}</strong>
        <div className="muted">{operator.email ?? 'Admin email not recorded'}</div>
      </td>
      <td><OperatorStatus status={operator.lifecycleStatus} /></td>
      <td><RoleBadges roles={operator.roles} /></td>
      <td>
        <strong>{operator.roles.includes(MASTER_ADMIN_ROLE) ? 'All access' : accessGroups.length ? accessGroups.join(', ') : 'No direct access'}</strong>
        <div className="muted">{operator.permission
          ? `${formatOperatorCount(operator.permission.effectiveLeafPermissionCount, 'permission')} effective · ${operator.permission.storedPermissionCount} stored entries`
          : 'No permission policy saved — access is blocked'}</div>
      </td>
      <td>
        <strong>{operator.credential?.mfaState === 'VERIFIED' ? 'MFA verified' : 'MFA required'}</strong>
        <div className="muted">{formatOperatorCount(operator.activeSessionCount, 'active session')}</div>
      </td>
      <td>
        {operator.credential?.lastLoginAt ? <DateTimeText value={operator.credential.lastLoginAt} /> : <span>Never signed in</span>}
        <div className="muted">{operator.lastSession?.platformSummary ?? 'Admin Web device not recorded'}</div>
      </td>
      <td>
        <AdminFormControlLink
          aria-label={`View access for ${operatorIdentity(operator)}`}
          className="button-secondary"
          href={operatorAccessHref(params, {
            historyCursor: undefined,
            historyCursorHistory: undefined,
            invite: undefined,
            operatorId: operator.id,
            tab: 'overview',
          })}
        >
          View access
        </AdminFormControlLink>
      </td>
    </tr>
  );
}

function CommandLink({
  href,
  label,
  tone = 'neutral',
  value,
}: {
  readonly href: string;
  readonly label: string;
  readonly tone?: 'danger' | 'neutral' | 'warning';
  readonly value: number;
}) {
  return (
    <Link className={`operator-access-command-link is-${tone}`} href={href} prefetch={false}>
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}

function OperatorDetail({
  currentUserId,
  history,
  historyOk,
  isMaster,
  operator,
  params,
  sessions,
  sessionsOk,
}: {
  readonly currentUserId?: string;
  readonly history: OperatorHistory;
  readonly historyOk: boolean;
  readonly isMaster: boolean;
  readonly operator: OperatorDirectoryItem;
  readonly params: PageParams;
  readonly sessions: OperatorSession[];
  readonly sessionsOk: boolean;
}) {
  const tab = ['access', 'sessions', 'history'].includes(params.tab ?? '') ? params.tab! : 'overview';
  const effectiveCategories = operator.permission?.effectiveCategories
    ?? expandLegacyAdminOperatorCategories(operator.permission?.categories ?? []);
  return (
    <div className="operator-access-detail">
      <div className="operator-access-detail-identity">
        <div><Users aria-hidden="true" size={20} /><span><strong>{operatorIdentity(operator)}</strong><small>{operator.email ?? operator.id}</small></span></div>
        <OperatorStatus status={operator.lifecycleStatus} />
      </div>
      <nav aria-label="Operator detail sections" className="operator-access-tabs">
        {['overview', 'access', 'sessions', 'history'].map((value) => (
          <Link aria-current={tab === value ? 'page' : undefined} href={operatorAccessHref(params, { tab: value })} key={value} prefetch={false} scroll={false}>
            {value === 'overview' ? 'Overview' : value === 'access' ? 'Access' : value === 'sessions' ? 'Sessions' : 'Change history'}
          </Link>
        ))}
      </nav>
      {tab === 'overview' ? (
        <div className="operator-access-overview-grid">
          <AdminCard><span className="muted">Roles</span><RoleBadges roles={operator.roles} /></AdminCard>
          <AdminCard><span className="muted">Effective access</span><strong>{formatOperatorCount(effectiveCategories.length, 'permission')}</strong></AdminCard>
          <AdminCard><span className="muted">Authentication</span><strong>{operator.credential ? 'Setup complete' : 'Setup required'}</strong></AdminCard>
          <AdminCard><span className="muted">MFA</span><strong>{operator.credential?.mfaState === 'VERIFIED' ? 'Verified' : 'Required'}</strong></AdminCard>
          <AdminCard><span className="muted">Active sessions</span><strong>{operator.activeSessionCount}</strong></AdminCard>
          <AdminCard><span className="muted">Internal ID</span><code>{operator.id}</code></AdminCard>
          {operator.roles.includes(FINANCE_APPROVER_ROLE) ? (
            <AdminInlineNotice role="note" tone="info">
              <span>Finance Approver is read-only here.</span>
              <AdminFormControlLink className="button-secondary" href="/finance-tax/finance-approvers">Manage Finance Approver role</AdminFormControlLink>
            </AdminInlineNotice>
          ) : null}
          {isMaster && currentUserId !== operator.id ? (
            <>
              <ReauthenticateOperatorForm />
              {operator.credential?.mfaState === 'VERIFIED' ? (
                <ResetAdminMfaForm operatorId={operator.id} operatorName={operatorIdentity(operator)} />
              ) : null}
              {operator.lifecycleStatus === 'SUSPENDED'
                ? operator.allowedActions.reactivate.allowed
                  ? <OperatorStatusForm activeSessionCount={operator.activeSessionCount} operatorId={operator.id} operatorName={operatorIdentity(operator)} suspended />
                  : <ActionBlockers decision={operator.allowedActions.reactivate} label="Reactivation unavailable" />
                : operator.allowedActions.suspend.allowed
                  ? <OperatorStatusForm activeSessionCount={operator.activeSessionCount} operatorId={operator.id} operatorName={operatorIdentity(operator)} suspended={false} />
                  : <ActionBlockers decision={operator.allowedActions.suspend} label="Suspension unavailable" />}
              {operator.allowedActions.revokeOperatorAccess.allowed ? (
                <OffboardOperatorForm operatorId={operator.id} operatorName={operatorIdentity(operator)} />
              ) : (
                <ActionBlockers decision={operator.allowedActions.revokeOperatorAccess} label="Offboarding preflight" />
              )}
            </>
          ) : null}
        </div>
      ) : null}
      {tab === 'access' ? (
        <div>
          {operator.permission ? (
            <>
              <div className="operator-access-effective-summary">
                <strong>{operator.roles.includes(MASTER_ADMIN_ROLE) ? 'All access through Master Admin role' : `${formatOperatorCount(effectiveCategories.length, 'effective permission')}`}</strong>
                <span className="muted">Stored entries {operator.permission.storedPermissionCount}. Finance Approver is managed separately.</span>
              </div>
              {isMaster && currentUserId !== operator.id && operator.allowedActions.updateAccess.allowed ? (
                <>
                  <ReauthenticateOperatorForm />
                  <OperatorAccessForm
                    activeSessionCount={operator.activeSessionCount}
                    categories={effectiveCategories}
                    expectedVersion={operator.permission.version}
                    operatorId={operator.id}
                    operatorName={operatorIdentity(operator)}
                    roles={operator.roles}
                  />
                </>
              ) : operator.allowedActions.updateAccess.blockedReasons.length
                ? <ActionBlockers decision={operator.allowedActions.updateAccess} label="Access update unavailable" />
                : <ReadOnlyMessage self={currentUserId === operator.id} />}
            </>
          ) : (
            <>
              <AdminInlineNotice role="alert" tone="warning">
                <span><strong>Permission policy required.</strong> No permission policy is saved — access is blocked.</span>
              </AdminInlineNotice>
              {isMaster && currentUserId !== operator.id && operator.allowedActions.initializeAccess.allowed ? (
                <>
                  <ReauthenticateOperatorForm />
                  <InitializeOperatorPermissionForm
                    activeSessionCount={operator.activeSessionCount}
                    operatorId={operator.id}
                    operatorName={operatorIdentity(operator)}
                  />
                </>
              ) : operator.allowedActions.initializeAccess.blockedReasons.length
                ? <ActionBlockers decision={operator.allowedActions.initializeAccess} label="Permission initialization unavailable" />
                : <ReadOnlyMessage self={currentUserId === operator.id} />}
            </>
          )}
        </div>
      ) : null}
      {tab === 'sessions' ? (
        !isMaster ? <ReadOnlyMessage /> : !sessionsOk ? <LoadFailure label="Admin Web sessions could not be loaded." /> : (
          <div className="operator-access-session-list">
            {sessions.length ? sessions.map((session) => (
              <div key={session.id}>
                <span>
                  <strong>{session.current ? 'You · current session' : session.revokedAt ? 'Revoked session' : 'Admin Web session'}</strong>
                  <small>{session.platformSummary ?? 'Device details unavailable for this sign-in'}</small>
                </span>
                <span><DateTimeText value={session.lastSeenAt} /><small>Last seen</small></span>
                <StatusBadge tone={session.revokedAt ? 'neutral' : new Date(session.expiresAt) > new Date() ? 'success' : 'warning'}>
                  {session.revokedAt ? 'Revoked' : new Date(session.expiresAt) > new Date() ? 'Active' : 'Expired'}
                </StatusBadge>
                {!session.revokedAt && new Date(session.expiresAt) > new Date() ? (
                  <SessionRevokeForm current={session.current} operatorId={operator.id} sessionId={session.id} />
                ) : null}
              </div>
            )) : <p className="muted">No Admin Web sessions have been recorded.</p>}
          </div>
        )
      ) : null}
      {tab === 'history' ? (
        !isMaster ? <ReadOnlyMessage /> : !historyOk ? <LoadFailure label="Access change history could not be loaded." /> : (
          <div className="operator-access-history-list">
            <p className="muted">{formatOperatorCount(history.totalCount, 'exact lifecycle event')}. Page views are excluded.</p>
            {history.items.length ? history.items.map((event) => (
              <div className="operator-access-history-row" key={event.id}>
                <div><History aria-hidden="true" size={16} /><span><strong>{historyActionLabel(event.action)}</strong><small>{operatorHistoryActorLabel(event.actor)}</small></span></div>
                <p>{historyReason(event.metadata)}</p>
                <span><DateTimeText value={event.createdAt} /><small>Audit ID: {event.id}</small></span>
              </div>
            )) : <p className="muted">No operator lifecycle changes have been recorded.</p>}
            {history.page.hasNextPage && history.page.nextCursor ? (
              <div className="operator-access-pagination">
                <span className="muted">{history.page.returned} shown · {history.totalCount} total</span>
                {params.historyCursor ? (
                  <>
                    <AdminFormControlLink className="button-secondary" href={operatorAccessHref(params, { historyCursor: undefined, historyCursorHistory: undefined })}>
                      First
                    </AdminFormControlLink>
                    <AdminFormControlLink className="button-secondary" href={previousHistoryPageHref(params)}>
                      Previous
                    </AdminFormControlLink>
                  </>
                ) : null}
                <AdminFormControlLink className="button-secondary" href={nextHistoryPageHref(params, history.page.nextCursor)}>
                  Next
                </AdminFormControlLink>
              </div>
            ) : params.historyCursor ? (
              <div className="operator-access-pagination">
                <span className="muted">Oldest page · {history.totalCount} total</span>
                <AdminFormControlLink className="button-secondary" href={operatorAccessHref(params, { historyCursor: undefined, historyCursorHistory: undefined })}>First</AdminFormControlLink>
                <AdminFormControlLink className="button-secondary" href={previousHistoryPageHref(params)}>Previous</AdminFormControlLink>
              </div>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

function OperatorStatus({ status }: { readonly status: OperatorDirectoryItem['lifecycleStatus'] }) {
  const value = {
    ACTIVE: { label: 'Active', tone: 'success' },
    LOCKED: { label: 'Locked', tone: 'danger' },
    MIGRATION_REQUIRED: { label: 'Migration required', tone: 'warning' },
    SETUP_REQUIRED: { label: 'Setup required', tone: 'warning' },
    SUSPENDED: { label: 'Suspended', tone: 'neutral' },
  }[status] as { label: string; tone: 'danger' | 'neutral' | 'success' | 'warning' };
  return <StatusBadge tone={value.tone}>{value.label}</StatusBadge>;
}

function RoleBadges({ roles }: { readonly roles: readonly string[] }) {
  return (
    <div className="operator-access-role-badges">
      {roles.filter((role) => [MASTER_ADMIN_ROLE, FINANCE_APPROVER_ROLE, 'ADMIN'].includes(role)).map((role) => (
        <StatusBadge key={role} tone={role === MASTER_ADMIN_ROLE ? 'primary' : role === FINANCE_APPROVER_ROLE ? 'success' : 'neutral'}>
          {role === MASTER_ADMIN_ROLE ? 'Master Admin' : role === FINANCE_APPROVER_ROLE ? 'Finance Approver' : 'Admin'}
        </StatusBadge>
      ))}
    </div>
  );
}

function ReadOnlyMessage({ self = false }: { readonly self?: boolean }) {
  return (
    <AdminInlineNotice role="status" tone="info">
      <KeyRound aria-hidden="true" size={16} />
      <span>{self
        ? 'Your own operator access is read-only. Another active Master Admin must change it.'
        : 'Master Admin access is required to change operator access.'}</span>
    </AdminInlineNotice>
  );
}

function ActionBlockers({ decision, label }: { readonly decision: OperatorActionDecision; readonly label: string }) {
  if (decision.allowed) return null;
  return (
    <AdminInlineNotice role="note" tone="info">
      <span>
        <strong>{label}.</strong>{' '}
        {decision.blockedReasons.map((reason) => reason.message).join(' ')}
      </span>
    </AdminInlineNotice>
  );
}

function LoadFailure({ label }: { readonly label: string }) {
  return (
    <AdminInlineNotice role="alert" tone="danger">
      <span>{label}</span>
      <AdminFormControlLink className="button-secondary" href="/admin-operators">Retry</AdminFormControlLink>
    </AdminInlineNotice>
  );
}

function operatorAccessGroups(operator: OperatorDirectoryItem) {
  const categories = new Set(
    operator.permission?.effectiveCategories
      ?? expandLegacyAdminOperatorCategories(operator.permission?.categories ?? []),
  );
  return [...new Set(adminOperatorPermissionCategoryDefinitions.filter((definition) => categories.has(definition.key)).map((definition) => definition.group))];
}

function operatorIdentity(operator: Pick<OperatorDirectoryItem, 'email' | 'fullName' | 'id'>) {
  return operator.fullName || operator.email || operator.id;
}

function directoryQuery(params: PageParams) {
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.status) query.set('status', params.status);
  if (params.role) query.set('role', params.role);
  if (params.category) query.set('category', params.category);
  if (params.cursor) query.set('cursor', params.cursor);
  query.set('take', '25');
  return query.toString();
}

function operatorAccessHref(params: PageParams, changes: Partial<Record<keyof PageParams, string | undefined>>) {
  const query = new URLSearchParams();
  const nextCursor = 'cursor' in changes ? changes.cursor : params.cursor;
  const cursorHistory = 'cursorHistory' in changes
    ? changes.cursorHistory
    : ('cursor' in changes && changes.cursor && changes.cursor !== params.cursor)
      ? encodeCursorHistory([...decodeCursorHistory(params.cursorHistory), params.cursor ?? null])
      : params.cursorHistory;
  for (const key of [
    'q',
    'status',
    'role',
    'category',
    'invite',
    'existingEmail',
    'operatorId',
    'tab',
    'historyCursor',
    'historyCursorHistory',
  ] as const) {
    const value = key in changes ? changes[key] : params[key];
    if (value) query.set(key, value);
  }
  if (nextCursor) query.set('cursor', nextCursor);
  if (cursorHistory) query.set('cursorHistory', cursorHistory);
  const suffix = query.toString();
  return suffix ? `/admin-operators?${suffix}` : '/admin-operators';
}

function nextHistoryPageHref(params: PageParams, nextCursor: string) {
  return operatorAccessHref(params, {
    historyCursor: nextCursor,
    historyCursorHistory: encodeCursorHistory([
      ...decodeCursorHistory(params.historyCursorHistory),
      params.historyCursor ?? null,
    ]),
  });
}

function previousHistoryPageHref(params: PageParams) {
  const history = decodeCursorHistory(params.historyCursorHistory);
  const previousCursor = history.at(-1) ?? null;
  const nextHistory = history.slice(0, -1);
  return operatorAccessHref(params, {
    historyCursor: previousCursor ?? undefined,
    historyCursorHistory: nextHistory.length ? encodeCursorHistory(nextHistory) : undefined,
  });
}

function previousPageHref(params: PageParams) {
  const history = decodeCursorHistory(params.cursorHistory);
  const previousCursor = history.at(-1) ?? null;
  const nextHistory = history.slice(0, -1);
  return operatorAccessHref(params, {
    cursor: previousCursor ?? undefined,
    cursorHistory: nextHistory.length ? encodeCursorHistory(nextHistory) : undefined,
  });
}

function decodeCursorHistory(value: string | undefined): Array<string | null> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string | null => item === null || typeof item === 'string').slice(-20)
      : [];
  } catch {
    return [];
  }
}

function encodeCursorHistory(value: Array<string | null>) {
  return Buffer.from(JSON.stringify(value.slice(-20))).toString('base64url');
}

function hasDirectoryFilters(params: PageParams) {
  return Boolean(params.q || params.status || params.role || params.category);
}

function historyActionLabel(action: string) {
  return action.replace(/^admin_operator\./u, '').replace(/\./gu, ' ').replace(/_/gu, ' ');
}

function historyReason(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return 'No reason recorded';
  const reason = (metadata as Record<string, unknown>).reason;
  return typeof reason === 'string' && reason.trim() ? reason : 'System authentication event';
}
