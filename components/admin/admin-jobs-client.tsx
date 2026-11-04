"use client";

import { Play } from "lucide-react";
import AdminCard from "@/components/admin/admin-card";
import AdminPageHeading from "@/components/admin/admin-page-heading";
import AdminStatusChip from "@/components/admin/admin-status-chip";
import ErrorCard from "@/components/ui/feedback/error-card";
import LoadingButton from "@/components/ui/buttons/loading-button";
import TableSkeleton from "@/components/ui/loaders/table-skeleton";
import { useFeedback } from "@/components/feedback/feedback-provider";
import { useApiRequest } from "@/hooks/use-api-request";
import { useAsyncAction } from "@/hooks/use-async-action";
import { apiRequest } from "@/lib/api/api-client";
import { formatDateTime, formatNumber, humanizeStatus } from "@/lib/format";

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
  jobs: { name: string; description: string; runPath?: string; runs: JobRun[] }[];
};

function duration(run: JobRun) {
  if (!run.finishedAt) return "—";
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export default function AdminJobsClient() {
  const feedback = useFeedback();
  const { data, loading, error, refetch } = useApiRequest<JobsPayload>("/api/v1/admin/jobs");

  const { run: triggerJob, loading: running } = useAsyncAction(async (job: { name: string; runPath: string }) => {
    try {
      await apiRequest(job.runPath, { method: "POST" });
      feedback.success("Job finished", `${humanizeStatus(job.name)} job executed.`);
      await refetch();
    } catch (jobError) {
      feedback.error("Job failed", jobError instanceof Error ? jobError.message : "Try again.");
    }
    return null;
  });

  const jobs = data?.jobs ?? [];

  return (
    <>
      <AdminPageHeading
        eyebrow="Operations"
        title="Background jobs"
        description="Scheduled maintenance tasks and their execution history."
        action={
          <LoadingButton type="button" variant="secondary" loading={loading} onClick={() => void refetch()}>
            Refresh
          </LoadingButton>
        }
      />

      {error ? (
        <ErrorCard
          title="Unable to load jobs"
          description={error}
          action={<LoadingButton type="button" onClick={() => void refetch()}>Try again</LoadingButton>}
        />
      ) : loading && !data ? (
        <TableSkeleton rows={5} />
      ) : jobs.length === 0 ? (
        <div className="admin-empty-results" role="status">No background jobs are registered.</div>
      ) : (
        <div className="admin-stack">
          {jobs.map((job) => (
            <AdminCard
              key={job.name}
              title={humanizeStatus(job.name)}
              description={job.description}
              action={
                job.runPath ? (
                  <LoadingButton
                    type="button"
                    icon={<Play size={13} aria-hidden="true" />}
                    loading={running}
                    loadingText="Running…"
                    onClick={() => void triggerJob({ name: job.name, runPath: job.runPath! })}
                  >
                    Run now
                  </LoadingButton>
                ) : null
              }
            >
              {job.runs.length === 0 ? (
                <div className="admin-empty-results" role="status">This job has not run yet.</div>
              ) : (
                <div className="admin-table-wrap is-flush">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th scope="col">Started</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="is-numeric">Processed</th>
                        <th scope="col" className="is-numeric">Failed</th>
                        <th scope="col">Duration</th>
                        <th scope="col">Trigger</th>
                        <th scope="col">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {job.runs.map((run) => (
                        <tr key={run._id}>
                          <td>{formatDateTime(run.startedAt)}</td>
                          <td><AdminStatusChip status={run.status} /></td>
                          <td className="is-numeric">{formatNumber(run.processedCount)}</td>
                          <td className="is-numeric">{run.failedCount > 0 ? <strong className="admin-danger-text">{formatNumber(run.failedCount)}</strong> : 0}</td>
                          <td>{duration(run)}</td>
                          <td>{humanizeStatus(run.triggeredBy)}</td>
                          <td><span className="admin-truncate" title={run.errorSummary}>{run.errorSummary || "—"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminCard>
          ))}
        </div>
      )}
    </>
  );
}
