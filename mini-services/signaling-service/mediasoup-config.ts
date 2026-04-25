// mediasoup worker and router configuration
// Audio-optimized settings:
// - Lower bitrate for audio (32-128 kbps opus)
// - No video by default (audio-first)
// - Adaptive bitrate support
// - Good codec selection (opus preferred)

export const mediasoupConfig = {
  // Worker settings
  numWorkers: 1, // Can scale up in production

  // Router settings (audio-optimized)
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          useinbandfec: 1,
          usedtx: 1,
          maxplaybackrate: 48000,
        },
      },
    ],
  },

  // WebRTC transport settings
  webRtcTransport: {
    listenIps: [
      { ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP || '127.0.0.1' },
    ],
    initialAvailableOutgoingBitrate: 100000,
    minimumAvailableOutgoingBitrate: 30000,
    maxIncomingBitrate: 150000,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  },

  // Producer settings (audio-first)
  producer: {
    codecOptions: {
      opusStereo: false,
      opusFec: true,
      opusDtx: true,
      opusMaxPlaybackRate: 48000,
      opusPtime: 20,
    },
    maxBitrate: 128000, // 128kbps max for audio
  },

  // Consumer settings
  consumer: {
    preferredCodecs: [{ kind: 'audio', mimeType: 'audio/opus' }],
    // Allow paused consumers to resume
    paused: false,
  },
};

// Bandwidth profiles for adaptive quality
export const bandwidthProfiles = {
  excellent: { maxBitrate: 128000, targetBitrate: 96000 },
  good: { maxBitrate: 96000, targetBitrate: 64000 },
  fair: { maxBitrate: 64000, targetBitrate: 48000 },
  poor: { maxBitrate: 32000, targetBitrate: 24000 },
} as const;

export type BandwidthProfile = keyof typeof bandwidthProfiles;
