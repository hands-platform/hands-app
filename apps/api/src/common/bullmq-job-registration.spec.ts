import { registerOrRetryBullJob } from './bullmq-job-registration';

const durableJob = {
  name: 'durable-job',
  data: { recordId: 'record-1' },
  options: { jobId: 'durable-job-record-1' },
};

describe('registerOrRetryBullJob', () => {
  it('retries a retained failed job instead of treating a duplicate add as recovery', async () => {
    const existing = {
      getState: vi.fn().mockResolvedValue('failed'),
      retry: vi.fn().mockResolvedValue(undefined),
    };
    const queue = {
      add: vi.fn(),
      getJob: vi.fn().mockResolvedValue(existing),
    };

    await expect(registerOrRetryBullJob(queue as never, durableJob)).resolves.toEqual({
      jobId: 'durable-job-record-1',
      status: 'RETRIED',
    });
    expect(existing.retry).toHaveBeenCalledOnce();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('leaves an existing active job alone', async () => {
    const existing = {
      getState: vi.fn().mockResolvedValue('active'),
      retry: vi.fn(),
    };
    const queue = {
      add: vi.fn(),
      getJob: vi.fn().mockResolvedValue(existing),
    };

    await expect(registerOrRetryBullJob(queue as never, durableJob)).resolves.toEqual({
      jobId: 'durable-job-record-1',
      status: 'EXISTING',
    });
    expect(existing.retry).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('adds a job only when its stable id does not exist', async () => {
    const queue = {
      add: vi.fn().mockResolvedValue({ id: 'durable-job-record-1' }),
      getJob: vi.fn().mockResolvedValue(null),
    };

    await expect(registerOrRetryBullJob(queue as never, durableJob)).resolves.toEqual({
      jobId: 'durable-job-record-1',
      status: 'REGISTERED',
    });
    expect(queue.add).toHaveBeenCalledWith(durableJob.name, durableJob.data, durableJob.options);
  });

  it('treats a concurrent retry as existing work', async () => {
    const current = { getState: vi.fn().mockResolvedValue('waiting') };
    const existing = {
      getState: vi.fn().mockResolvedValue('failed'),
      retry: vi.fn().mockRejectedValue(new Error('job is not failed')),
    };
    const queue = {
      add: vi.fn(),
      getJob: vi.fn().mockResolvedValueOnce(existing).mockResolvedValueOnce(current),
    };

    await expect(registerOrRetryBullJob(queue as never, durableJob)).resolves.toEqual({
      jobId: 'durable-job-record-1',
      status: 'EXISTING',
    });
  });
});
