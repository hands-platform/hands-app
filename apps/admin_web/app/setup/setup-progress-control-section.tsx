import { CommandCopyRow } from '../../components/command-copy-row';
import { PathCopyRow } from '../../components/path-copy-row';

type SetupProgressStep = {
  readonly phase: string;
  readonly title: string;
  readonly detail: string;
  readonly status: string;
};

type SetupProgressControlSectionProps = {
  readonly sequence: readonly SetupProgressStep[];
  readonly verifiedBaseline: readonly string[];
};

export function SetupProgressControlSection({
  sequence,
  verifiedBaseline,
}: SetupProgressControlSectionProps) {
  return (
    <section className="detail-grid admin-mb-16">
      <div className="card">
        <div className="ops-section-header">
          <div>
            <h2>Master progress control</h2>
            <p className="muted">
              This is the single operating order for HANDS MVP work. Keep new requests inside this sequence
              unless an urgent production blocker appears.
            </p>
          </div>
          <span className="signal signal-info">Roadmap locked</span>
        </div>
        <div className="setup-stage-list">
          {sequence.map((item) => (
            <div className="setup-stage-item" key={item.phase}>
              <span>{item.phase}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <small>{item.status}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="ops-section-header">
          <div>
            <h2>Verified baseline</h2>
            <p className="muted">
              These checks were used to reset the project state before continuing. If one fails later, fix it
              before moving to the next feature.
            </p>
          </div>
          <span className="signal signal-ok">{verifiedBaseline.length} checks</span>
        </div>
        <div className="setup-command-list">
          {verifiedBaseline.map((item) => (
            <CommandCopyRow
              command={item}
              copiedLabel="Baseline check copied"
              failedLabel="Copy baseline check failed"
              key={item}
              label="Copy baseline check"
            />
          ))}
        </div>
        <div className="setup-command-block admin-mt-16">
          <h3>Single source of truth</h3>
          <p className="muted">
            Update this file whenever a phase changes, a skipped item is resumed, or a new external dependency
            becomes required.
          </p>
          <div className="setup-command-list">
            <PathCopyRow path="docs\architecture\master-progress-roadmap.md" />
          </div>
        </div>
      </div>
    </section>
  );
}
