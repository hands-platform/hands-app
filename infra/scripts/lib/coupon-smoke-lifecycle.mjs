export async function runCouponSmokeLifecycle({
  activate,
  pause,
  run,
  pauseAttempts = 2,
  launchEnabled = process.env.COUPON_LAUNCH_ENABLED === 'true',
}) {
  if (!launchEnabled) {
    throw new Error('Coupon smoke is disabled for the current launch.');
  }
  const boundedPauseAttempts = Math.min(3, Math.max(1, Math.trunc(pauseAttempts)));
  let lifecycleError;

  try {
    await activate();
    return await run();
  } catch (error) {
    lifecycleError = error;
    throw error;
  } finally {
    let cleanupError;
    for (let attempt = 0; attempt < boundedPauseAttempts; attempt += 1) {
      try {
        await pause();
        cleanupError = undefined;
        break;
      } catch (error) {
        cleanupError = error;
      }
    }

    if (cleanupError) {
      const cleanupFailure = new Error(
        `Coupon smoke cleanup failed after ${boundedPauseAttempts} pause attempts.`,
        { cause: cleanupError },
      );
      if (lifecycleError) {
        throw new AggregateError(
          [lifecycleError, cleanupFailure],
          'Coupon smoke lifecycle and cleanup both failed.',
        );
      }
      throw cleanupFailure;
    }
  }
}
