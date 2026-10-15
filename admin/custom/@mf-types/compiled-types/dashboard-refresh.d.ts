export type DashboardSocket = {
    /** Sends a command to one adapter instance. */
    sendTo?: (target: string, command: string, data: unknown) => Promise<unknown>;
};
type Handlers<T> = {
    onSources: (sources: T[]) => void;
    onError: () => void;
};
/** Coordinates dashboard tab requests across refreshes and adapter lifecycle changes. */
export declare class DashboardRefresh<T> {
    private readonly latest;
    private socket;
    private target;
    /**
     * Invalidates pending work when the adapter instance or socket changes.
     *
     * @param socket Socket providing the current instance's message transport.
     * @param target Fully qualified adapter instance ID.
     */
    setIdentity(socket: DashboardSocket | undefined, target: string): void;
    /**
     * Loads the current dashboard sources, routing only the latest response.
     *
     * @param fallback Data used when no socket is available.
     * @param handlers Callbacks for the newest dashboard response.
     * @param handlers.onSources Applies the current sources and clears obsolete errors.
     * @param handlers.onError Reports a current request or response error.
     */
    refresh(fallback: T[], handlers: Handlers<T>): Promise<void>;
    /** Stops pending request callbacks after effect cleanup or unmount. */
    invalidate(): void;
}
export {};
