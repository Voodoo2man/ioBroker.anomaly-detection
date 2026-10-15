import { LatestRequest } from "./latest-request.ts";

export type DashboardSocket = {
	/** Sends a command to one adapter instance. */
	sendTo?: (target: string, command: string, data: unknown) => Promise<unknown>;
};

type Handlers<T> = {
	onSources: (sources: T[]) => void;
	onError: () => void;
};

/** Coordinates dashboard tab requests across refreshes and adapter lifecycle changes. */
export class DashboardRefresh<T> {
	private readonly latest = new LatestRequest();
	private socket: DashboardSocket | undefined;
	private target: string | undefined;

	/**
	 * Invalidates pending work when the adapter instance or socket changes.
	 *
	 * @param socket Socket providing the current instance's message transport.
	 * @param target Fully qualified adapter instance ID.
	 */
	setIdentity(socket: DashboardSocket | undefined, target: string): void {
		if (this.socket !== socket || this.target !== target) {
			this.latest.invalidate();
			this.socket = socket;
			this.target = target;
		}
	}

	/**
	 * Loads the current dashboard sources, routing only the latest response.
	 *
	 * @param fallback Data used when no socket is available.
	 * @param handlers Callbacks for the newest dashboard response.
	 * @param handlers.onSources Applies the current sources and clears obsolete errors.
	 * @param handlers.onError Reports a current request or response error.
	 */
	refresh(fallback: T[], handlers: Handlers<T>): Promise<void> {
		if (!this.socket?.sendTo) {
			this.latest.invalidate();
			handlers.onSources(fallback);
			return Promise.resolve();
		}

		const { socket, target } = this;
		return this.latest.run(() => socket.sendTo!(target!, "tab", {}), {
			onSuccess: response => {
				const sources = (response as { data?: { sources?: unknown } } | undefined)?.data?.sources;
				if (Array.isArray(sources)) {
					handlers.onSources(sources as T[]);
				} else {
					handlers.onError();
				}
			},
			onError: handlers.onError,
		});
	}

	/** Stops pending request callbacks after effect cleanup or unmount. */
	invalidate(): void {
		this.latest.invalidate();
	}
}
