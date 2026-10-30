import { CircleAlert } from "lucide-react";

type IntegrationStateProps = {
  title: string;
  description: string;
  requirement: string;
};

export default function IntegrationState({
  title,
  description,
  requirement,
}: IntegrationStateProps) {
  return (
    <section className="admin-integration-state" role="status">
      <span className="admin-integration-icon"><CircleAlert size={20} aria-hidden="true" /></span>
      <div>
        <span className="admin-status-label">Integration required</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <small>Required: {requirement}</small>
      </div>
    </section>
  );
}