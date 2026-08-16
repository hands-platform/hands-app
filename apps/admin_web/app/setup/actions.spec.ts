import { revalidatePath } from 'next/cache';

import { adminGetResult } from '../../lib/admin-api';
import { refreshExternalServices, type SetupRefreshState } from './actions';

const INITIAL_SETUP_REFRESH_STATE: SetupRefreshState = {
  message: '',
  status: 'idle',
};

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../lib/admin-api', () => ({ adminGetResult: vi.fn() }));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('refreshExternalServices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revalidates setup only after a successful safe status read', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: { checks: [], currentStageOk: true, ok: true, timestamp: '2026-08-14T03:00:00.000Z' },
      ok: true,
      status: 200,
    });

    await expect(refreshExternalServices(INITIAL_SETUP_REFRESH_STATE, new FormData())).resolves.toEqual({
      message: 'External service status refreshed.',
      status: 'success',
    });
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/health/external', null);
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/setup');
  });

  it('keeps the current snapshot and reports an error when the status read fails', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: null, ok: false, status: 503 });

    await expect(refreshExternalServices(INITIAL_SETUP_REFRESH_STATE, new FormData())).resolves.toEqual({
      message: 'External service status could not be refreshed. The existing snapshot remains visible.',
      status: 'error',
    });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});
