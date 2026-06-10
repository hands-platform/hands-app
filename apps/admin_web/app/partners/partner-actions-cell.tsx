import { ActionMenu, type ActionMenuItem } from '../../components/action-menu';

type PartnerActionsCellProps = {
  readonly actions: readonly ActionMenuItem[];
  readonly partnerName: string;
};

export function PartnerActionsCell({ actions, partnerName }: PartnerActionsCellProps) {
  return <ActionMenu actions={actions} label={`Partner account actions for ${partnerName}`} />;
}
