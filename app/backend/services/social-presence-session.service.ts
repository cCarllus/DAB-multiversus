export class SocialPresenceSessionService {
  private readonly disconnectorsBySessionId = new Map<string, Set<() => void | Promise<void>>>();

  registerSession(
    sessionId: string,
    disconnect: () => void | Promise<void>,
  ): () => void {
    const disconnectors = this.disconnectorsBySessionId.get(sessionId) ?? new Set();
    disconnectors.add(disconnect);
    this.disconnectorsBySessionId.set(sessionId, disconnectors);

    return () => {
      this.unregisterSession(sessionId, disconnect);
    };
  }

  unregisterSession(
    sessionId: string,
    disconnect?: () => void | Promise<void>,
  ): void {
    const disconnectors = this.disconnectorsBySessionId.get(sessionId);

    if (!disconnectors) {
      return;
    }

    if (disconnect) {
      disconnectors.delete(disconnect);
    } else {
      disconnectors.clear();
    }

    if (disconnectors.size === 0) {
      this.disconnectorsBySessionId.delete(sessionId);
    }
  }

  async disconnectSession(sessionId: string): Promise<boolean> {
    const disconnectors = [...(this.disconnectorsBySessionId.get(sessionId) ?? [])];

    if (disconnectors.length === 0) {
      return false;
    }

    this.disconnectorsBySessionId.delete(sessionId);
    await Promise.allSettled(disconnectors.map((disconnect) => Promise.resolve(disconnect())));
    return true;
  }
}
