import { PathCopyRow } from '../../components/path-copy-row';
import { AdminStageItemLink, AdminStageList } from '../../components/admin-stage-item';
import { AdminSection } from '../../components/admin-surface';

type SetupMigrationRunwayStatus = {
  readonly id: string;
  readonly title: string;
  readonly phase: string;
  readonly status: string;
};

type SetupMigrationRunwaySectionProps = {
  readonly groupStatuses: readonly SetupMigrationRunwayStatus[];
};

export function SetupMigrationRunwaySection({ groupStatuses }: SetupMigrationRunwaySectionProps) {
  return (
    <AdminSection
      description="HANDS is moving from local MVP stability to Supabase-backed staging without breaking the mobile booking flow. Current local auth remains Nest/dev OTP until production Phone Auth is deliberately tested."
      title="Migration runway"
    >
      <AdminStageList>
        {groupStatuses.map((item, index) => (
          <AdminStageItemLink href={`#${item.id}`} key={item.id}>
            <span>Stage {index + 1}</span>
            <strong>{item.phase}</strong>
            <p>{item.title}</p>
            <small>{item.status}</small>
          </AdminStageItemLink>
        ))}
      </AdminStageList>
      <div className="setup-command-block admin-mt-16">
        <h3>Operator handoff files</h3>
        <p className="muted">
          Use these files when filling external console values. They stay in the repo path under
          <code>C:\dev\massage-on-demand-vn</code>.
        </p>
        <div className="setup-command-list">
          <PathCopyRow path="docs\architecture\operator-registration-plan.md" />
          <PathCopyRow path="docs\architecture\master-progress-roadmap.md" />
          <PathCopyRow path="infra\setup\.generated\hands-external-registration-pack.md" />
          <PathCopyRow path="infra\supabase\.generated\hands-staging-setup.sql" />
        </div>
      </div>
    </AdminSection>
  );
}
