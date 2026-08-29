import { AdminGovernanceRoutes } from './admin-governance.routes';

describe('Shift Handoff launch route gates', () => {
  it('rejects note, send, and acknowledgement before the Admin service when disabled', () => {
    vi.stubEnv('SHIFT_HANDOFF_LAUNCH_ENABLED', 'false');
    try {
      const admin = {
        acknowledgeOperationsShiftHandoff: vi.fn(),
        addOperationsHandoffNote: vi.fn(),
        createOperationsShiftHandoff: vi.fn(),
      };
      const routes = new AdminGovernanceRoutes(admin as never);
      const user = { id: 'admin-1' } as never;

      expect(() => routes.addOperationsHandoffNote(user, {} as never)).toThrow(
        'Shift Handoff is not active for the current launch',
      );
      expect(() => routes.createOperationsShiftHandoff(user, {} as never)).toThrow(
        'Shift Handoff is not active for the current launch',
      );
      expect(() => routes.acknowledgeOperationsShiftHandoff(user, 'handoff-1')).toThrow(
        'Shift Handoff is not active for the current launch',
      );
      expect(admin.addOperationsHandoffNote).not.toHaveBeenCalled();
      expect(admin.createOperationsShiftHandoff).not.toHaveBeenCalled();
      expect(admin.acknowledgeOperationsShiftHandoff).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
