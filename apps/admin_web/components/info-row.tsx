type InfoRowProps = {
  label: string;
  value: string;
  detail: string;
};

export function InfoRow({ label, value, detail }: InfoRowProps) {
  return (
    <tr>
      <td>
        <strong>{label}</strong>
        <div className="muted">{detail}</div>
      </td>
      <td>{value}</td>
    </tr>
  );
}
