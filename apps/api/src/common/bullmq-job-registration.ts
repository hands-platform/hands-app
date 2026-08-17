import type { JobsOptions, Queue } from 'bullmq';

export type BullJobRegistration = {
  jobId: string | null;
  status: 'EXISTING' | 'REGISTERED' | 'RETRIED';
};

export async function registerOrRetryBullJob(
  queue: Queue,
  job: { data: Record<string, unknown>; name: string; options: JobsOptions },
): Promise<BullJobRegistration> {
  const jobId = job.options.jobId == null ? null : String(job.options.jobId);
  if (jobId) {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed') {
        try {
          await existing.retry();
          return { jobId, status: 'RETRIED' };
        } catch (error) {
          const current = await queue.getJob(jobId);
          if (current && (await current.getState()) !== 'failed') {
            return { jobId, status: 'EXISTING' };
          }
          throw error;
        }
      }
      return { jobId, status: 'EXISTING' };
    }
  }

  const queued = await queue.add(job.name, job.data, job.options);
  return {
    jobId: queued?.id == null ? jobId : String(queued.id),
    status: 'REGISTERED',
  };
}
