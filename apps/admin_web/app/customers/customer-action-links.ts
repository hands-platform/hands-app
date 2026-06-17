import { Eye, MessageSquareText, ReceiptText, type LucideIcon } from 'lucide-react';

export type CustomerActionLink = {
  readonly ariaLabel: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
};

type CustomerActionLinkInput = {
  readonly chatHref: string;
  readonly detailHref: string;
  readonly name: string;
  readonly paymentsHref: string;
};

export function customerActionLinks({
  chatHref,
  detailHref,
  name,
  paymentsHref,
}: CustomerActionLinkInput): readonly CustomerActionLink[] {
  return [
    {
      ariaLabel: `Open ${name}`,
      href: detailHref,
      icon: Eye,
      label: 'View profile',
    },
    {
      ariaLabel: `Open ${name} payments`,
      href: paymentsHref,
      icon: ReceiptText,
      label: 'Payment records',
    },
    {
      ariaLabel: `Open ${name} chats`,
      href: chatHref,
      icon: MessageSquareText,
      label: 'Chat archive',
    },
  ];
}
