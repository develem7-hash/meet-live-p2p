// Connection quality monitoring
// - Track latency measurements between client pings
// - Classify connection quality: excellent, good, fair, poor, disconnected
// - Trigger adaptive bitrate changes based on quality
// - Notify participants of quality changes

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'disconnected';

export const QUALITY_THRESHOLDS = {
  excellent: { maxLatency: 50 },
  good: { maxLatency: 150 },
  fair: { maxLatency: 300 },
  poor: { maxLatency: 600 },
} as const;

// Number of samples to keep for rolling average
const LATENCY_HISTORY_SIZE = 20;
// Minimum samples before quality assessment is reliable
const MIN_SAMPLES_FOR_ASSESSMENT = 3;

export interface ConnectionState {
  socketId: string;
  lastPingAt: number;
  latencyHistory: number[];
  qualityLevel: ConnectionQuality;
  previousQualityLevel: ConnectionQuality | null;
}

export class ConnectionMonitor {
  private connections = new Map<string, ConnectionState>();

  /**
   * Record a ping measurement from a client.
   * @param socketId - Socket ID of the client
   * @param latencyMs - Round-trip latency in milliseconds
   */
  recordPing(socketId: string, latencyMs: number): ConnectionQuality | null {
    let state = this.connections.get(socketId);

    if (!state) {
      state = {
        socketId,
        lastPingAt: Date.now(),
        latencyHistory: [],
        qualityLevel: 'excellent',
        previousQualityLevel: null,
      };
      this.connections.set(socketId, state);
    }

    state.lastPingAt = Date.now();
    state.latencyHistory.push(latencyMs);

    // Keep only recent history
    if (state.latencyHistory.length > LATENCY_HISTORY_SIZE) {
      state.latencyHistory.shift();
    }

    // Only assess quality if we have enough samples
    if (state.latencyHistory.length < MIN_SAMPLES_FOR_ASSESSMENT) {
      return null;
    }

    const previousQuality = state.qualityLevel;
    const newQuality = this.classifyQuality(state.latencyHistory);

    if (newQuality !== previousQuality) {
      state.previousQualityLevel = previousQuality;
      state.qualityLevel = newQuality;
      return newQuality; // Return new quality only when it changed
    }

    return null; // No change
  }

  /**
   * Get the current connection quality level.
   */
  getQuality(socketId: string): ConnectionQuality {
    const state = this.connections.get(socketId);
    if (!state) return 'disconnected';
    return state.qualityLevel;
  }

  /**
   * Get the average latency over the rolling window.
   */
  getAverageLatency(socketId: string): number {
    const state = this.connections.get(socketId);
    if (!state || state.latencyHistory.length === 0) return -1;

    const sum = state.latencyHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / state.latencyHistory.length);
  }

  /**
   * Determine whether to reduce media quality for this connection.
   */
  shouldReduceQuality(socketId: string): boolean {
    const quality = this.getQuality(socketId);
    return quality === 'fair' || quality === 'poor';
  }

  /**
   * Determine whether to restore media quality for this connection.
   */
  shouldRestoreQuality(socketId: string): boolean {
    const quality = this.getQuality(socketId);
    return quality === 'excellent' || quality === 'good';
  }

  /**
   * Get the recommended max bitrate based on connection quality.
   */
  getRecommendedBitrate(socketId: string): number {
    const quality = this.getQuality(socketId);
    const bitrateMap: Record<ConnectionQuality, number> = {
      excellent: 128000,
      good: 96000,
      fair: 64000,
      poor: 32000,
      disconnected: 24000,
    };
    return bitrateMap[quality];
  }

  /**
   * Get connection stats for a specific socket.
   */
  getConnectionStats(socketId: string): {
    quality: ConnectionQuality;
    avgLatency: number;
    sampleCount: number;
  } | null {
    const state = this.connections.get(socketId);
    if (!state) return null;

    return {
      quality: state.qualityLevel,
      avgLatency: this.getAverageLatency(socketId),
      sampleCount: state.latencyHistory.length,
    };
  }

  /**
   * Get all connection qualities for sockets in a given set.
   */
  getAllQualities(socketIds?: string[]): Record<string, ConnectionQuality> {
    const result: Record<string, ConnectionQuality> = {};
    const ids = socketIds || Array.from(this.connections.keys());

    for (const id of ids) {
      const state = this.connections.get(id);
      if (state) {
        result[id] = state.qualityLevel;
      }
    }

    return result;
  }

  /**
   * Remove a connection's monitoring state.
   */
  removeConnection(socketId: string): void {
    this.connections.delete(socketId);
  }

  /**
   * Get total number of monitored connections.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Classify quality based on the rolling average of latencies.
   */
  private classifyQuality(latencies: number[]): ConnectionQuality {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    // Also check for high jitter (large variance) which indicates instability
    const jitter = this.calculateJitter(latencies);

    // Use the worse of latency or jitter to determine quality
    const effectiveLatency = Math.max(avgLatency, jitter * 3);

    if (effectiveLatency <= QUALITY_THRESHOLDS.excellent.maxLatency) {
      return 'excellent';
    } else if (effectiveLatency <= QUALITY_THRESHOLDS.good.maxLatency) {
      return 'good';
    } else if (effectiveLatency <= QUALITY_THRESHOLDS.fair.maxLatency) {
      return 'fair';
    } else if (effectiveLatency <= QUALITY_THRESHOLDS.poor.maxLatency) {
      return 'poor';
    }

    return 'poor';
  }

  /**
   * Calculate jitter (average difference between consecutive latencies).
   */
  private calculateJitter(latencies: number[]): number {
    if (latencies.length < 2) return 0;

    let totalDiff = 0;
    for (let i = 1; i < latencies.length; i++) {
      totalDiff += Math.abs(latencies[i] - latencies[i - 1]);
    }

    return totalDiff / (latencies.length - 1);
  }
}
