"use client";

import AdminPageHeading from "@/components/admin/admin-page-heading";
import LoadingButton from "@/components/ui/buttons/LoadingButton";
import TableSkeleton from "@/components/ui/loaders/TableSkeleton";
import { useFeedback } from "@/components/feedback/FeedbackProvider";
import { useApiRequest } from "@/hooks/useApiRequest";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { apiRequest } from "@/lib/api/api-client";

type JobRun = {
  _id: string;
  jobName: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  processedCount: number;
  failedCount: number;
  errorSummary?: string;
  triggeredBy: string;
};

type JobsPayload = {
  jobs: { name: string; description: string; runs: JobRun[] }[];
};

export default function AdminJobsClient() {
  const feedback = useFeedback();
  const { data, loading, error, refetch } = useApiRequest<JobsPayload>("/api/v1/admin/jobs");

  const { run: triggerJob, loading: running } = useAsyncAction(async () => {
    await apiRequest("/api/v1/admin/jobs/payment-expiry", { method: "POST" });
    feedback.success("Job finished", "Payment expiry job executed.");
    await refetch();
    return null;
  });

  if (loading && !data) return <TableSkeleton rows={5} />;

  const job = data?.jobs?.[0];

  return (
    <div className="admin-page">
      <AdminPageHeading
        eyebrow="Operations"
        title="Background jobs"
        description="Scheduled maintenance tasks and execution history."
        action={
          <LoadingButton type="button" loading={running} onClick={() => void triggerJob()}>
            Run payment expiry
          </LoadingButton>
        }
      />
      {error ? <p role="alert">{error}</p> : null}
      {job ? (
        <>
          <p>{job.description}</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Status</th>
                  <th>Processed</th>
                  <th>Failed</th>
                  <th>Trigger</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {job.runs.map((run) => (
                  <tr key={run._id}>
                    <td>{new Date(run.startedAt).toLocaleString()}</td>
                    <td>{run.status}</td>
                    <td>{run.processedCount}</td>
                    <td>{run.failedCount}</td>
                    <td>{run.triggeredBy}</td>
                    <td>{run.errorSummary || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
