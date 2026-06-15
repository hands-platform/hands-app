import Link from 'next/link';

import { addBookingOpsNote, updateBookingOpsTask } from './actions';

export type OperatorCommand = {
  id: string;
  label: string;
  title: string;
  detail: string;
  owner: string;
  tone: 'pill-success' | 'pill-info' | 'pill-warn' | 'pill-danger' | 'pill-neutral';
  action:
    | { type: 'link'; href: string; label: string }
    | { type: 'note'; preset: string; label: string }
    | { type: 'task'; taskType: string; taskStatus: string; label: string };
};

export type OpsTaskActionProps = {
  bookingId: string;
  type: string;
  status: string;
  label: string;
};

export type OperatorCommandActionProps = {
  bookingId: string;
  command: OperatorCommand;
};

export type ActionLinkProps = {
  href: string;
  label: string;
};

export function OpsTaskAction({
  bookingId,
  type,
  status,
  label,
}: OpsTaskActionProps) {
  return (
    <form action={updateBookingOpsTask}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="status" value={status} />
      <button type="submit">{label}</button>
    </form>
  );
}

export function OperatorCommandAction({ bookingId, command }: OperatorCommandActionProps) {
  if (command.action.type === 'link') {
    return <ActionLink href={command.action.href} label={command.action.label} />;
  }

  if (command.action.type === 'note') {
    return (
      <form action={addBookingOpsNote}>
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="preset" value={command.action.preset} />
        <button type="submit">{command.action.label}</button>
      </form>
    );
  }

  return (
    <OpsTaskAction
      bookingId={bookingId}
      type={command.action.taskType}
      status={command.action.taskStatus}
      label={command.action.label}
    />
  );
}

export function ActionLink({ href, label }: ActionLinkProps) {
  if (href.startsWith('/')) {
    return (
      <Link className="text-link" href={href}>
        {label}
      </Link>
    );
  }

  return (
    <a className="text-link" href={href}>
      {label}
    </a>
  );
}
