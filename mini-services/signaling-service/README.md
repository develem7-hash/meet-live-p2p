# MeetLive Signaling Service

Real-time signaling server for the MeetLive online meeting platform. Handles WebSocket communication via Socket.IO, WebRTC transport management through mediasoup, and connection quality monitoring.

## Quick Start

```bash
# Install dependencies
bun install

# Development (with hot reload)
bun run dev

# Production
bun start
```

The service runs on **port 3003**.

## Architecture

```
┌─────────────┐     Socket.IO      ┌──────────────────┐     mediasoup     ┌────────────┐
│   Client    │ ◄───────────────► │  Signaling Service│ ◄───────────────► │   Router   │
│  (Browser)  │   WebSocket (:81)  │   (Port 3003)    │   WebRTC          │  + Worker  │
└─────────────┘                    └──────────────────┘                    └────────────┘
```

### Components

| File | Purpose |
|------|---------|
| `index.ts` | Main server: Socket.IO setup, all event handlers, disconnect/reconnect logic |
| `room-manager.ts` | `Room` class (router, transports, producers/consumers) and `RoomManager` singleton |
| `mediasoup-config.ts` | Audio-optimized mediasoup configuration and bandwidth profiles |
| `connection-monitor.ts` | Latency tracking, quality classification, adaptive bitrate recommendations |

### Mediasoup Architecture

- **One Router per meeting room** — each room gets its own mediasoup router
- **Audio-first** — optimized for Opus codec with FEC and DTX enabled
- **Two transports per participant** — one for sending (producer), one for receiving (consumer)
- **Adaptive bitrate** — quality monitor recommends bitrate based on connection quality
- **Simulated mode** — if mediasoup is unavailable (e.g., port restrictions), the service falls back to signaling-only mode with simulated transport objects

## Socket.IO Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{ meetingId, userId, displayName, role? }` | Join a meeting room |
| `leave-room` | — | Leave current room |
| `get-router-rtp-capabilities` | `{ meetingId? }` | Get mediasoup router capabilities |
| `create-transport` | `{ direction: 'send' \| 'recv' }` | Create WebRTC transport |
| `connect-transport` | `{ transportId, dtlsParameters }` | Connect transport with DTLS |
| `produce` | `{ kind, rtpParameters, appData? }` | Create audio producer |
| `consume` | `{ producerId, rtpCapabilities }` | Consume another's audio |
| `pause-producer` | `{ producerId }` | Mute (pause audio) |
| `resume-producer` | `{ producerId }` | Unmute (resume audio) |
| `ping` | `{ clientTimestamp }` | Latency measurement |
| `request-quality` | — | Get current connection quality |
| `kick-participant` | `{ targetSocketId, reason? }` | Host kicks a participant |
| `mute-participant` | `{ targetSocketId }` | Host mutes a participant |
| `lock-room` | — | Host locks the room |
| `unlock-room` | — | Host unlocks the room |
| `reconnect` | `{ meetingId, userId, displayName, role? }` | Rejoin after network drop |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room-joined` | `{ meetingId, participants, isSimulated, isLocked }` | Sent after successful join |
| `router-rtp-capabilities` | `{ rtpCapabilities }` | Router's RTP capabilities |
| `transport-created` | `{ transportInfo, direction }` | WebRTC transport ready |
| `transport-connected` | `{ transportId }` | Transport DTLS connected |
| `producer-created` | `{ producerId, kind }` | Your producer is live |
| `consumer-created` | `{ id, producerId, kind, rtpParameters, producerSocketId }` | Consumer ready |
| `participant-joined` | `{ socketId, userId, displayName, role, joinedAt }` | New participant joined |
| `participant-left` | `{ socketId, userId, displayName, reason }` | Participant left |
| `participant-disconnected` | `{ socketId, userId, displayName }` | Temporarily disconnected |
| `participant-rejoined` | `{ socketId, userId, displayName, role }` | Participant reconnected |
| `new-producer` | `{ producerId, producerSocketId, kind }` | New audio stream available |
| `producer-paused` | `{ producerId, producerSocketId }` | Audio muted |
| `producer-resumed` | `{ producerId, producerSocketId }` | Audio unmuted |
| `participant-kicked` | `{ reason, kickedBy }` | You were kicked |
| `participant-muted` | `{ mutedBy, producerIds }` | Host muted you |
| `room-locked` | `{ lockedBy }` | Room locked |
| `room-unlocked` | `{ unlockedBy }` | Room unlocked |
| `quality-update` | `{ quality, avgLatency, recommendedBitrate }` | Connection quality |
| `participant-quality-changed` | `{ socketId, quality }` | Someone's quality changed |
| `error` | `{ message, code }` | Error message |
| `pong` | `{ serverTimestamp, clientTimestamp }` | Ping response |

## Connection to Next.js App

The Next.js frontend connects to this service through the Caddy gateway:

```typescript
import { io } from 'socket.io-client';

// Connect via Caddy gateway (port 81)
const socket = io('/?XTransformPort=3003', {
  path: '/',
  transports: ['websocket'],
});
```

The `XTransformPort=3003` query parameter tells Caddy to forward requests to the signaling service.

## Reconnect Strategy

1. On disconnect, the server starts a **30-second timer** before removing the participant
2. If the client reconnects within that window (using the `reconnect` event), the room state is restored
3. After 30 seconds, the participant is fully removed and others are notified
4. Empty rooms are cleaned up after 60 seconds

## Connection Quality Levels

| Level | Max Latency | Max Bitrate | Target Bitrate |
|-------|-------------|-------------|----------------|
| Excellent | ≤ 50ms | 128 kbps | 96 kbps |
| Good | ≤ 150ms | 96 kbps | 64 kbps |
| Fair | ≤ 300ms | 64 kbps | 48 kbps |
| Poor | > 300ms | 32 kbps | 24 kbps |

Quality is assessed after a minimum of 3 ping samples using a rolling window of 20 samples. Both average latency and jitter are factored into the classification.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANNOUNCED_IP` | `127.0.0.1` | Public IP announced to clients for ICE |
