import { Fragment, type ReactNode } from 'react';

type FinanceOperatingPathStep = {
  readonly label: string;
  readonly value: ReactNode;
  readonly detail?: ReactNode;
};

type FinanceOperatingPathProps = {
  readonly ariaLabel: string;
  readonly steps: readonly FinanceOperatingPathStep[];
};

export function FinanceOperatingPath({ ariaLabel, steps }: FinanceOperatingPathProps) {
  return (
    <div className="finance-reconciliation-path admin-mt-16" aria-label={ariaLabel}>
      {steps.map((step, index) => (
        <Fragment key={`${step.label}-${index}`}>
          {index > 0 ? (
            <span className="finance-reconciliation-path-connector" aria-hidden="true">
              -&gt;
            </span>
          ) : null}
          <div className="finance-reconciliation-path-node">
            <span>{step.label}</span>
            <strong>{step.value}</strong>
            {step.detail === undefined || step.detail === null ? null : <small>{step.detail}</small>}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
