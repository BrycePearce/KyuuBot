const DEFAULT_TYPING_INTERVAL_MS = 8_000;

export function startTypingKeepalive(
  sendTyping: () => Promise<void>,
  intervalMs = DEFAULT_TYPING_INTERVAL_MS,
  onError: (error: unknown) => void = (error) => console.warn('Failed to refresh .comic typing indicator:', error)
): () => void {
  let stopped = false;
  let hasReportedError = false;

  const refresh = () => {
    if (stopped) return;

    void sendTyping().catch((error) => {
      if (hasReportedError) return;
      hasReportedError = true;
      onError(error);
    });
  };

  refresh();
  const timer = setInterval(refresh, intervalMs);
  timer.unref();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
