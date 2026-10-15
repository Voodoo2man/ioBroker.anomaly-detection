/** Runs asynchronous work while allowing only the newest request to update its owner. */
export declare class LatestRequest {
    private generation;
    /** Invalidates pending request handlers, usually when an effect is cleaned up. */
    invalidate(): void;
    /**
     * Runs a request and routes the result without allowing stale completions or rejections to win.
     *
     * @param request Operation to start.
     * @param handlers Callbacks for the current request.
     * @param handlers.onSuccess Receives the newest successful response.
     * @param handlers.onError Reports failure of the newest request.
     * @param handlers.onSettled Clears the newest request's loading state.
     */
    run<T>(request: () => Promise<T>, handlers: {
        onSuccess: (value: T) => void;
        onError: () => void;
        onSettled?: () => void;
    }): Promise<void>;
}
