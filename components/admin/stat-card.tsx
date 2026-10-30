type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  state?: "available" | "unavailable";
};

export default function StatCard({
  label,
  value,
  detail,
  state = "available",
}: StatCardProps) {
  return (
    <article className={`admin-stat-card admin-stat-${state}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}