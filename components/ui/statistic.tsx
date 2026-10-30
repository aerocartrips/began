type StatisticProps = {
  value: string;
  label: string;
};

export default function Statistic({ value, label }: StatisticProps) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}