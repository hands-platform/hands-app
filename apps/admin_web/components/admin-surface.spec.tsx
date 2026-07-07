import { readFileSync } from 'node:fs';

import {
  AdminActionCard,
  AdminActionFormCard,
  AdminAsideCard,
  AdminBasicTimeline,
  AdminCard,
  AdminCardGrid,
  AdminCardHeader,
  AdminDisclosure,
  AdminDialogCard,
  AdminDrawerSurface,
  AdminDisclosureCard,
  AdminDetailGrid,
  AdminErrorState,
  AdminFormCard,
  AdminInsightCard,
  AdminInsightLinkCard,
  AdminKpiCard,
  AdminLinkCard,
  AdminLoadingState,
  AdminNoteCard,
  AdminNotePanel,
  AdminNoticeCard,
  AdminRowItem,
  AdminRowLink,
  AdminSection,
  AdminSurfaceBlock,
  AdminTaskCard,
  AdminTaskBreakdown,
  AdminTaskGrid,
} from './admin-surface';

describe('Admin surface components', () => {
  it('uses the shared AdminSignal atom for surface signal labels', () => {
    const source = readFileSync('components/admin-surface.tsx', 'utf8');

    expect(source).toContain('AdminSignal');
    expect(source).not.toContain("<span className={joinClassNames('signal', signalClassName)}>{signalLabel}</span>");
  });

  it('renders a Vuexy-aligned card shell with stable aria hooks', () => {
    const card = AdminCard({
      ariaLabelledBy: 'finance-title',
      children: <p>Finance content</p>,
      className: 'finance-card',
      id: 'finance-card',
    });

    expect(card.type).toBe('section');
    expect(card.props).toMatchObject({
      'aria-labelledby': 'finance-title',
      className: 'card admin-card finance-card',
      id: 'finance-card',
    });
  });

  it('renders a reusable Vuexy card grid wrapper without losing page hooks', () => {
    const grid = AdminCardGrid({
      ariaLabel: 'Operator category cards',
      children: <AdminCard>Operator card</AdminCard>,
      className: 'admin-operator-permission-grid',
    });

    expect(grid.type).toBe('div');
    expect(grid.props).toMatchObject({
      'aria-label': 'Operator category cards',
      className: 'admin-card-grid admin-operator-permission-grid',
    });
  });

  it('renders a reusable Vuexy card header with card-level heading semantics', () => {
    const header = AdminCardHeader({
      actions: <a href="/partners">Open</a>,
      description: 'Bounded queue for operators.',
      title: 'Partner action queue',
    });

    expect(header.type).toBe('div');
    expect(header.props.className).toBe('ops-section-header admin-section-header admin-card-header');
    expect(header.props.children[0].props.children[0].type).toBe('h3');
    expect(header.props.children[0].props.children[0].props.children).toBe('Partner action queue');
    expect(header.props.children[0].props.children[1].props.children).toBe('Bounded queue for operators.');
    expect(header.props.children[1].props.className).toBe('participant-list admin-card-header-actions');
  });

  it('deduplicates Vuexy surface class tokens passed by legacy callers', () => {
    const card = AdminCard({
      children: <p>Finance content</p>,
      className: 'card admin-card finance-card',
    });
    const section = AdminSection({
      children: <div>Rows</div>,
      className: 'card admin-section finance-section',
      title: 'Finance section',
    });

    expect(card.props.className).toBe('card admin-card finance-card');
    expect(section.props.className).toBe('card admin-section finance-section');
  });

  it('renders a Vuexy-aligned aside card shell for secondary panels', () => {
    const aside = AdminAsideCard({
      ariaLabel: 'Calendar filters',
      children: <p>Filters</p>,
      className: 'calendar-sidebar',
    });

    expect(aside.type).toBe('aside');
    expect(aside.props).toMatchObject({
      'aria-label': 'Calendar filters',
      className: 'card admin-card calendar-sidebar',
    });
  });

  it('renders a reusable admin section with title, status, body, and footer', () => {
    const section = AdminSection({
      children: <div>Rows</div>,
      description: 'Vuexy section rhythm for admin operations.',
      footer: <p>Footer note</p>,
      id: 'booking-section',
      statusLabel: 'Ready',
      statusTone: 'success',
      title: 'Booking section',
    });

    expect(section.type).toBe('section');
    expect(section.props).toMatchObject({
      'aria-labelledby': 'booking-section-title',
      className: 'card admin-section',
      id: 'booking-section',
    });
    expect(section.props.children).toHaveLength(3);
    expect(section.props.children[0].props.className).toBe('ops-section-header admin-section-header');
    expect(section.props.children[0].props.children[1].props.className).toBe('participant-list admin-section-actions');
    expect(section.props.children[0].props.children[1].props.children[0].props.tone).toBe('success');
    expect(section.props.children[1].props.className).toBe('admin-section-body');
    expect(section.props.children[2].props.className).toBe('admin-section-footer');
  });

  it('renders a reusable detail grid wrapper with aria hooks', () => {
    const grid = AdminDetailGrid({
      ariaLabel: 'Session breakdown',
      children: <section>Rows</section>,
      className: 'admin-mb-16',
    });

    expect(grid.type).toBe('section');
    expect(grid.props).toMatchObject({
      'aria-label': 'Session breakdown',
      className: 'detail-grid admin-mb-16',
    });
  });

  it('renders a shared non-card block surface for grouped content inside cards', () => {
    const block = AdminSurfaceBlock({
      ariaLabelledBy: 'review-block-title',
      children: <p>Review records</p>,
      className: 'admin-review-records-block',
    });

    expect(block.type).toBe('section');
    expect(block.props).toMatchObject({
      'aria-labelledby': 'review-block-title',
      className: 'admin-review-records-block',
    });
  });

  it('renders a reusable Vuexy note panel surface with stable spacing classes', () => {
    const panel = AdminNotePanel({
      children: <p>Operational note</p>,
      className: 'admin-mt-14',
    });

    expect(panel.type).toBe('div');
    expect(panel.props).toMatchObject({
      className: 'ops-task-note admin-mt-14',
    });
  });

  it('renders a reusable Vuexy note card surface on the shared admin card', () => {
    const card = AdminNoteCard({
      children: <p>Operational card note</p>,
      className: 'booking-supply-panel',
    });

    expect(card.type.name).toBe('AdminCard');
    expect(card.props).toMatchObject({
      className: 'ops-task-note booking-supply-panel',
    });
  });

  it('keeps KPI cards on the existing shared metric-card implementation', () => {
    const card = AdminKpiCard({
      helper: 'From payment clearing records.',
      href: '/finance-tax/payment-clearing',
      label: 'Payment queue',
      value: 8,
    });

    expect(card.type.name).toBe('MetricCard');
    expect(card.props).toMatchObject({
      helper: 'From payment clearing records.',
      href: '/finance-tax/payment-clearing',
      label: 'Payment queue',
      value: 8,
    });
  });

  it('renders a reusable clickable card shell without losing admin-card styling', () => {
    const card = AdminLinkCard({
      ariaLabel: 'Open payment clearing',
      children: <span>Payment clearing</span>,
      className: 'finance-overview-control-card',
      href: '/finance-tax/payment-clearing',
    });

    expect(card.props).toMatchObject({
      'aria-label': 'Open payment clearing',
      className: 'card admin-card finance-overview-control-card',
      href: '/finance-tax/payment-clearing',
    });
  });

  it('renders reusable Vuexy row link and row item surfaces without losing page row classes', () => {
    const link = AdminRowLink({
      ariaLabel: 'Open Vietnam region',
      children: <span>Ho Chi Minh</span>,
      className: 'vietnam-realtime-region-row',
      href: '/vietnam-overview?region=hcm',
    });
    const item = AdminRowItem({
      children: <span>Unlinked finance row</span>,
      className: 'finance-overview-row',
    });

    expect(link.props).toMatchObject({
      'aria-label': 'Open Vietnam region',
      className: 'admin-row-link vietnam-realtime-region-row',
      href: '/vietnam-overview?region=hcm',
    });
    expect(item.type).toBe('div');
    expect(item.props.className).toBe('admin-row-link finance-overview-row');
  });

  it('renders reusable Vuexy insight cards for dense policy decision blocks', () => {
    const card = AdminInsightCard({
      children: <strong>Keep launch policy</strong>,
      className: 'is-highlighted',
    });
    const linkCard = AdminInsightLinkCard({
      children: <strong>Open matching records</strong>,
      href: '/bookings?view=matching',
    });

    expect(card.type.name).toBe('AdminCard');
    expect(card.props.className).toBe('insight-card is-highlighted');
    expect(linkCard.type.name).toBe('AdminLinkCard');
    expect(linkCard.props).toMatchObject({
      className: 'insight-card',
      href: '/bookings?view=matching',
    });
  });

  it('renders a reusable Vuexy notice card surface', () => {
    const notice = AdminNoticeCard({
      children: <strong>Saved</strong>,
      className: 'admin-mb-16 admin-notice-success',
      role: 'status',
    });

    expect(notice.type).toBe('section');
    expect(notice.props).toMatchObject({
      className: 'card admin-card admin-notice-card admin-mb-16 admin-notice-success',
      role: 'status',
    });
  });

  it('maps notice tones to the shared Vuexy notice classes', () => {
    const notice = AdminNoticeCard({
      children: <strong>Blocked</strong>,
      className: 'admin-mb-16',
      role: 'alert',
      tone: 'danger',
    });

    expect(notice.props).toMatchObject({
      className: 'card admin-card admin-notice-card admin-notice-danger admin-mb-16',
      role: 'alert',
    });
  });

  it('renders Vuexy alert slots for card notices, including legacy tone classNames', () => {
    const notice = AdminNoticeCard({
      children: <strong>Saved</strong>,
      className: 'admin-mb-16 admin-notice-success',
      role: 'status',
    });

    expect(notice.props.children[0].props).toMatchObject({
      'aria-hidden': true,
      className: 'admin-notice-card-icon',
    });
    expect(notice.props.children[1].props).toMatchObject({
      className: 'admin-notice-card-message',
    });
    expect(notice.props.children[1].props.children.props.children).toBe('Saved');
  });

  it('renders a reusable Vuexy disclosure card surface', () => {
    const disclosure = AdminDisclosureCard({
      children: <summary>Open record</summary>,
      className: 'chat-transcript-room',
      id: 'chat-room-1',
      open: true,
    });

    expect(disclosure.type).toBe('details');
    expect(disclosure.props).toMatchObject({
      className: 'card admin-card admin-disclosure chat-transcript-room',
      id: 'chat-room-1',
      open: true,
    });
  });

  it('renders a reusable Vuexy disclosure surface without adding nested card chrome', () => {
    const disclosure = AdminDisclosure({
      children: <summary>Open inline evidence</summary>,
      className: 'payment-payload-keys',
      open: true,
    });

    expect(disclosure.type).toBe('details');
    expect(disclosure.props).toMatchObject({
      className: 'admin-disclosure payment-payload-keys',
      open: true,
    });
  });

  it('renders a reusable Vuexy form card surface', () => {
    const form = AdminFormCard({
      action: '/admin/save',
      children: <input name="name" />,
      className: 'policy-form',
      id: 'policy-form',
      method: 'post',
    });

    expect(form.type).toBe('form');
    expect(form.props).toMatchObject({
      action: '/admin/save',
      className: 'card admin-card policy-form',
      id: 'policy-form',
      method: 'post',
    });
  });

  it('renders a reusable Vuexy action form card surface for operational writes', () => {
    const form = AdminActionFormCard({
      action: '/admin/bookings/capture',
      children: <button type="submit">Capture</button>,
      className: 'ops-task-blocked',
    });

    expect(form.type).toBe('form');
    expect(form.props).toMatchObject({
      action: '/admin/bookings/capture',
      className: 'action-button-card ops-task-blocked',
    });
  });

  it('renders a reusable Vuexy dialog card surface with alertdialog semantics', () => {
    const dialog = AdminDialogCard({
      ariaDescribedBy: 'confirm-description',
      ariaLabelledBy: 'confirm-title',
      children: <p>Confirm</p>,
      className: 'admin-dialog-card',
      loading: true,
    });

    expect(dialog.type).toBe('section');
    expect(dialog.props).toMatchObject({
      'aria-busy': true,
      'aria-describedby': 'confirm-description',
      'aria-labelledby': 'confirm-title',
      className: 'card admin-card admin-dialog-card',
      role: 'alertdialog',
    });
  });

  it('renders a reusable Vuexy drawer surface for app side panels', () => {
    const drawer = AdminDrawerSurface({
      ariaLabel: 'Event editor',
      ariaLabelledBy: 'event-editor-title',
      children: <p>Drawer content</p>,
      className: 'calendar-drawer',
    });

    expect(drawer.type).toBe('aside');
    expect(drawer.props).toMatchObject({
      'aria-label': 'Event editor',
      'aria-labelledby': 'event-editor-title',
      className: 'calendar-drawer',
    });
  });

  it('renders a reusable clickable action card surface', () => {
    const card = AdminActionCard({
      children: <span className="pill">ready: 2</span>,
      detail: 'Operators can open this filtered queue.',
      href: '/bookings?view=matching',
      signalClassName: 'signal-warn',
      signalLabel: 'Monitor',
      title: 'Matching queue',
      value: '3 open',
    });

    expect(card.props).toMatchObject({
      className: 'card admin-action-card',
      href: '/bookings?view=matching',
    });
  });

  it('renders the shared Vuexy ops task card surface for command boards', () => {
    const card = AdminActionCard({
      actionLabel: 'Open queue',
      actionLabelClassName: 'button button-secondary admin-inline-action',
      className: 'ops-task-pending',
      detail: 'Operators can open this filtered queue.',
      href: '/bookings?view=matching',
      signalClassName: 'signal-warn',
      signalLabel: 'Monitor',
      title: 'Matching queue',
      value: null,
      variant: 'ops-task',
    });

    expect(card.props).toMatchObject({
      className: 'ops-task-card ops-task-pending',
      href: '/bookings?view=matching',
    });
    const children = card.props.children.filter(Boolean);

    expect(children[0].props.className).toBe('signal signal-warn');
    expect(children[1].type).toBe('h3');
    expect(children[2].type).toBe('p');
    expect(children[3].type).toBe('small');
    expect(children[3].props.className).toBe('button button-secondary admin-inline-action');
  });

  it('supports value-first ops task cards without forcing an empty heading', () => {
    const card = AdminActionCard({
      detail: 'No marketplace participant action is needed.',
      href: '/bookings?view=marketplace',
      signalClassName: 'pill-success',
      signalLabel: 'Clear',
      value: '0',
      variant: 'ops-task',
    });
    const children = card.props.children.filter(Boolean);

    expect(children.map((child: { type: unknown }) => child.type)).toEqual(['span', 'strong', 'p']);
  });

  it('renders clickable ops signal cards without page-level class wiring', () => {
    const card = AdminActionCard({
      actionLabel: 'Open Customer',
      href: '/customers/customer-1',
      title: 'Customer Mai',
      variant: 'ops-signal',
    });

    expect(card.props).toMatchObject({
      className: 'ops-task-card ops-signal-card',
      href: '/customers/customer-1',
    });
  });

  it('renders a static Vuexy ops task card surface for non-clickable states', () => {
    const card = AdminTaskCard({
      detail: 'First-pick, supply, customer choice, chat handoff, and wallet unblock lanes are clear.',
      signalClassName: 'signal-ok',
      signalLabel: 'Clear',
      title: 'No marketplace lane needs action',
    });

    expect(card.props.className).toBe('ops-task-card');
    expect(card.props.children.filter(Boolean).map((child: { type: unknown }) => child.type)).toEqual([
      'span',
      'h3',
      'p',
    ]);
  });

  it('renders static ops signal cards through the shared task variant', () => {
    const card = AdminTaskCard({
      detail: 'Last-known location monitoring.',
      value: 'Fresh',
      variant: 'ops-signal',
    });

    expect(card.props.className).toBe('ops-task-card ops-signal-card');
  });

  it('renders static blocked action cards through the shared task variant', () => {
    const card = AdminTaskCard({
      actionLabel: 'Payment buttons appear after a payment row exists.',
      variant: 'ops-blocked',
    });

    expect(card.props.className).toBe('ops-task-card action-button-card ops-task-blocked');
  });

  it('renders a reusable Vuexy ops task grid wrapper with stable spacing classes', () => {
    const grid = AdminTaskGrid({
      children: <AdminTaskCard title="Wallet guard" detail="Partner balance is checked." />,
      className: 'admin-mt-14',
    });

    expect(grid.type).toBe('div');
    expect(grid.props.className).toBe('ops-task-grid admin-mt-14');
  });

  it('renders reusable Vuexy task breakdown metrics with tone and optional links', () => {
    const breakdown = AdminTaskBreakdown({
      items: [
        {
          href: '/partners?review=cash-debt',
          label: 'Cash debt',
          tone: 'danger',
          value: '3',
        },
        {
          label: 'Ready partners',
          tone: 'ok',
          value: '12',
        },
      ],
    });

    expect(breakdown.type).toBe('div');
    expect(breakdown.props.className).toBe('ops-task-breakdown');
    expect(breakdown.props.children[0].props).toMatchObject({
      className: 'ops-task-breakdown-item ops-task-breakdown-danger',
      href: '/partners?review=cash-debt',
    });
    expect(breakdown.props.children[0].props.children[0].props.children).toBe('Cash debt');
    expect(breakdown.props.children[0].props.children[1].props.children).toBe('3');
    expect(breakdown.props.children[1].type).toBe('span');
    expect(breakdown.props.children[1].props.className).toBe('ops-task-breakdown-item ops-task-breakdown-ok');
  });

  it('renders reusable Vuexy basic timeline markup with dot, connector, status, time, and meta rows', () => {
    const timeline = AdminBasicTimeline({
      className: 'booking-operating-timeline-list admin-mt-16',
      compactMeta: true,
      items: [
        {
          detail: 'Partner accepted the booking request.',
          id: 'match-accepted',
          meta: [
            { label: 'Type', value: 'MATCH' },
            { label: 'State', value: 'ACCEPTED' },
          ],
          statusLabel: 'ACCEPTED',
          statusTone: 'success',
          time: '15 Jul 2026, 10:30',
          title: 'Partner matched',
          tone: 'success',
        },
        {
          detail: 'Customer chat room retained.',
          id: 'chat-retained',
          title: 'Chat archive',
          tone: 'info',
          value: '2 retained messages',
        },
      ],
    });

    expect(timeline.props.className).toBe(
      'vuexy-basic-timeline booking-operating-timeline-list admin-mt-16',
    );
    const firstItem = timeline.props.children[0];
    const secondItem = timeline.props.children[1];

    expect(firstItem.type).toBe('div');
    expect(firstItem.props.className).toBe('vuexy-basic-timeline-item');
    expect(firstItem.props.children[0].props.children[0].props.className).toBe(
      'vuexy-basic-timeline-dot is-success',
    );
    expect(firstItem.props.children[0].props.children[1].props.className).toBe(
      'vuexy-basic-timeline-connector',
    );
    expect(firstItem.props.children[1].props.children[0].props.children[0].props.children[0].props.tone).toBe(
      'success',
    );
    expect(firstItem.props.children[1].props.children[2].props.className).toBe(
      'vuexy-basic-timeline-meta is-compact',
    );
    expect(secondItem.props.children[0].props.children.filter(Boolean)).toHaveLength(1);
  });

  it('keeps timeline time slots compatible with shared DateTimeText atoms', () => {
    const sharedDateTimeAtom = (
      <time className="date-time-text" dateTime="2026-07-15T10:30:00.000Z">
        15 Jul 2026, 10:30
      </time>
    );
    const timeline = AdminBasicTimeline({
      items: [
        {
          id: 'shared-time-atom',
          time: sharedDateTimeAtom,
          title: 'Shared atom timestamp',
          tone: 'info',
        },
      ],
    });

    const titleRow = timeline.props.children[0].props.children[1].props.children[0];
    const timeSlot = titleRow.props.children[1];

    expect(timeSlot.type).toBe('span');
    expect(timeSlot.props.className).toBe('vuexy-basic-timeline-time');
    expect(timeSlot.props.children).toBe(sharedDateTimeAtom);
  });

  it('keeps duplicate timeline item ids and meta labels on unique React keys', () => {
    const timeline = AdminBasicTimeline({
      items: [
        {
          id: 'settlement',
          meta: [
            { label: 'Amount', value: '100,000 VND' },
            { label: 'Amount', value: '20,000 VND' },
          ],
          title: 'Settlement event',
          tone: 'success',
        },
        {
          id: 'settlement',
          title: 'Settlement reversal',
          tone: 'warning',
        },
      ],
    });
    const items = timeline.props.children;
    const firstMetaItems = items[0].props.children[1].props.children[2].props.children;

    expect(items.map((item: { key: string }) => item.key)).toEqual(['settlement-0', 'settlement-1']);
    expect(firstMetaItems.map((metaItem: { key: string }) => metaItem.key)).toEqual(['Amount-0', 'Amount-1']);
  });

  it('renders standard loading and error states with operational roles', () => {
    const loading = AdminLoadingState({ message: 'Checking latest booking records.' });
    const error = AdminErrorState({
      action: <a href="/bookings">Retry</a>,
      message: 'The booking API returned an error.',
    });

    expect(loading.props).toMatchObject({
      'aria-live': 'polite',
      className: 'admin-state admin-loading-state admin-state-info',
      role: 'status',
    });
    expect(error.props).toMatchObject({
      className: 'admin-state admin-error-state admin-state-danger',
      role: 'alert',
    });
    expect(error.props.children[1].props.children[2].props.className).toBe('admin-state-action');
  });
});
