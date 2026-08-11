'use client';

import { useState } from 'react';

import { AdminFormDate, AdminFormSelect } from '../../components/admin-form-controls';
import type { ChatArchiveDateRange } from './chat-archive-page-model';

type ChatArchiveDateRangeFieldsProps = {
  readonly initialFrom: string;
  readonly initialRange: ChatArchiveDateRange;
  readonly initialTo: string;
  readonly validationError: string | null;
};

export function ChatArchiveDateRangeFields({
  initialFrom,
  initialRange,
  initialTo,
  validationError,
}: ChatArchiveDateRangeFieldsProps) {
  const [range, setRange] = useState(initialRange);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const describedBy = [validationError ? 'chat-archive-date-error' : '', 'chat-archive-custom-range-help']
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <AdminFormSelect
        label="Message date"
        labelVisibility="visible"
        name="range"
        onChange={(event) => setRange(event.currentTarget.value as ChatArchiveDateRange)}
        options={[
          { label: 'All dates', value: 'all' },
          { label: 'Today', value: 'today' },
          { label: 'Last 7 days', value: '7d' },
          { label: 'Last 30 days', value: '30d' },
          { label: 'Custom', value: 'custom' },
        ]}
        value={range}
      />
      {range === 'custom' ? (
        <>
          <AdminFormDate
            ariaDescribedBy={describedBy}
            ariaInvalid={Boolean(validationError)}
            label="From"
            labelVisibility="visible"
            name="from"
            native
            onChange={(event) => setFrom(event.currentTarget.value)}
            required
            value={from}
          />
          <div className="chat-evidence-date-end">
            <AdminFormDate
              ariaDescribedBy={describedBy}
              ariaInvalid={Boolean(validationError)}
              label="To"
              labelVisibility="visible"
              name="to"
              native
              onChange={(event) => setTo(event.currentTarget.value)}
              required
              value={to}
            />
            <small className="muted" id="chat-archive-custom-range-help">
              Custom range: maximum 90 days.
            </small>
          </div>
        </>
      ) : null}
    </>
  );
}
