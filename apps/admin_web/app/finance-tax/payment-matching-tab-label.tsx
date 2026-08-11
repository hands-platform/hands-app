export function paymentMatchingTabLabel(label: string, count: number) {
  return (
    <>
      <span>{label}</span>
      <span aria-label={`${count} records`} className="payment-matching-tab-count">
        {count}
      </span>
    </>
  );
}
