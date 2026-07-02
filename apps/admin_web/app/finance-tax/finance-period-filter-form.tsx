import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
} from '../../components/admin-form-controls';

type FinancePeriodFilterFormProps = {
  readonly period: string;
  readonly rows?: {
    readonly name?: string;
    readonly options?: readonly number[];
    readonly value: number;
  };
  readonly submitLabel?: string;
};

const DEFAULT_ROW_OPTIONS = [25, 50, 75, 100] as const;

export function FinancePeriodFilterForm({
  period,
  rows,
  submitLabel = 'Apply period',
}: FinancePeriodFilterFormProps) {
  return (
    <form className="form-grid compact-form admin-mt-12" method="get">
      <AdminFormInput defaultValue={period} label="Month" labelVisibility="visible" name="period" type="month" />
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
      <AdminFormControlButton className="button button-primary" type="submit">
        {submitLabel}
      </AdminFormControlButton>
    </form>
  );
}
