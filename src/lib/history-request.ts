/**
 * Waits for a history request until it settles, times out, or shutdown aborts it.
 *
 * @param operation The pending history request.
 * @param signal The adapter shutdown signal.
 * @param timeoutMs The maximum time to wait.
 * @param setTimer Schedules the timeout using the owning runtime.
 * @param clearTimer Cancels the scheduled timeout.
 */
export function withAbortableTimeout<T, Timer>(
	operation: Promise<T>,
	signal: AbortSignal,
	timeoutMs: number,
	setTimer: (callback: () => void, delay: number) => Timer,
	clearTimer: (timer: Timer) => void,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		let settled = false;
		const timer = setTimer(() => finish(() => reject(new Error("History request timed out"))), timeoutMs);
		function finish(callback: () => void): void {
			if (settled) {
				return;
			}
			settled = true;
			clearTimer(timer);
			signal.removeEventListener("abort", onAbort);
			callback();
		}
		function onAbort(): void {
			finish(() => reject(new Error("History request aborted during shutdown")));
		}
		if (signal.aborted) {
			onAbort();
		} else {
			signal.addEventListener("abort", onAbort, { once: true });
		}
		operation.then(
			value => finish(() => resolve(value)),
			error => finish(() => reject(error instanceof Error ? error : new Error(String(error)))),
		);
	});
}
