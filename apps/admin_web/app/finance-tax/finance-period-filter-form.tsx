import {
  AdminFormControlButton,
  AdminFormDate,
  AdminFormGrid,
  AdminFormSelect,
} from '../../components/admin-form-controls';

type FinancePeriodFilterFormProps = {
  readonly action?: string;
  readonly className?: string;
  readonly hiddenFields?: readonly {
    readonly name: string;
    readonly value: string;
  }[];
  readonly period: string;
  readonly periodLabel?: string;
  readonly rows?: {
    readonly name?: string;
    readonly options?: readonly number[];
    readonly value: number;
  };
  readonly submitLabel?: string;
};

const DEFAULT_ROW_OPTIONS = [25, 50, 75, 100] as const;

export function FinancePeriodFilterForm({
  action,
  className = 'compact-form admin-mt-12',
  hiddenFields = [],
  period,
  periodLabel = 'Month',
  rows,
  submitLabel = 'Apply period',
}: FinancePeriodFilterFormProps) {
  return (
    <AdminFormGrid action={action} className={joinClassNames('finance-period-filter-form', className)} method="get">
      {hiddenFields.map((field) => (
        <input key={field.name} name={field.name} type="hidden" value={field.value} />
      ))}
      <AdminFormDate
        defaultValue={period}
        label={periodLabel}
        labelVisibility="visible"
        mode="month"
        name="period"
      />
      {rows ? (
        <AdminFormSelect
          defaultValue={String(rows.value)}
          label="Rows"
          labelVisibility="visible"
          name={rows.name ?? 'take'}
          options={(rows.options ?? DEFAULT_ROW_OPTIONS).map((take) => ({
            label: String(take),
            value: String(take),
          }))}
        />
      ) : null}
      <AdminFormControlButton className="button-primary" type="submit">
        {submitLabel}
      </AdminFormControlButton>
    </AdminFormGrid>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
