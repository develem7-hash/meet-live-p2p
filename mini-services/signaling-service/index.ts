// MeetLive Signaling Service
// Socket.IO-based signaling server for real-time audio communication
// Handles: WebSocket connections, mediasoup WebRTC transport management,
// audio producer/consumer routing, room state, quality monitoring

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { roomManager, Room } from './room-manager.js';
import { ConnectionMonitor } from './connection-monitor.js';
import type { ConnectionQuality } from './connection-monitor.js';
import { bandwidthProfiles } from './mediasoup-config.js';
import type { BandwidthProfile } from './mediasoup-config.js';

// ========================
// Configuration
// ========================

const PORT = 3003;
const RECONNECT_TIMEOUT_MS = 30_000; // 30 seconds to allow reconnect
const MAX_ROOM_PARTICIPANTS = 50;

// ========================
// State
// ========================

// Track socket -> meetingId mapping
const socketToRoom = new Map<string, string>();

// Track userId -> socketId for reconnect
const userToSocket = new Map<string, string>();

// Track pending reconnect timers
const reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Connection quality monitor
const connectionMonitor = new ConnectionMonitor();

// ========================
// HTTP & Socket.IO Setup
// ========================

const httpServer = createServer();

const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

// ========================
// Helpers
// ========================

interface JoinRoomPayload {
  meetingId: string;
  userId: string;
  displayName: string;
  role?: 'host' | 'co_host' | 'participant';
  token?: string;
}

interface BasePayload {
  meetingId: string;
}

/**
 * Send an error event to a socket.
 */
function sendError(socket: Socket, message: string, code?: string): void {
  socket.emit('error', { message, code: code || 'UNKNOWN_ERROR', timestamp: Date.now() });
}

/**
 * Validate that a socket is in a room and return the room.
 */
function getSocketRoom(socket: Socket): Room | null {
  const meetingId = socketToRoom.get(socket.id);
  if (!meetingId) return null;
  return roomManager.getRoom(meetingId) || null;
}

/**
 * Check if a user is the host of a room.
 */
function isHost(socket: Socket, room: Room): boolean {
  const participant = room.getParticipant(socket.id);
  return participant?.role === 'host' || participant?.role === 'co_host';
}

/**
 * Get quality level as a BandwidthProfile key.
 */
function qualityToBandwidthProfile(quality: ConnectionQuality): BandwidthProfile {
  switch (quality) {
    case 'excellent':
      return 'excellent';
    case 'good':
      return 'good';
    case 'fair':
      return 'fair';
    case 'poor':
    case 'disconnected':
    default:
      return 'poor';
  }
}

// ========================
// Event Handlers
// ========================

/**
 * Handle a new socket connection.
 */
io.on('connection', (socket: Socket) => {
  console.log(`[Signaling] Socket connected: ${socket.id}`);

  // ---- join-room ----
  socket.on('join-room', async (payload: JoinRoomPayload) => {
    try {
      const { meetingId, userId, displayName, role = 'participant', token } = payload;

      if (!meetingId || !userId || !displayName) {
        sendError(socket, 'Missing required fields: meetingId, userId, displayName');
        return;
      }

      // Check if already in a room
      if (socketToRoom.has(socket.id)) {
        sendError(socket, 'Already in a room. Leave first.');
        return;
      }

      // Check reconnect: if this userId was recently connected, cancel the disconnect timer
      const previousSocketId = userToSocket.get(userId);
      if (previousSocketId && reconnectTimers.has(previousSocketId)) {
        // Clear the reconnect timer, the old socket will be cleaned up
        clearTimeout(reconnectTimers.get(previousSocketId)!);
        reconnectTimers.delete(previousSocketId);
        socketToRoom.delete(previousSocketId);
        connectionMonitor.removeConnection(previousSocketId);
        console.log(`[Signaling] User ${userId} reconnected from ${previousSocketId} to ${socket.id}`);
      }

      // Get or create room
      const room = await roomManager.getOrCreateRoom(meetingId);

      // Check room lock
      if (room.isLocked) {
        // Hosts and co-hosts can still join locked rooms
        if (role !== 'host' && role !== 'co_host') {
          sendError(socket, 'Room is locked', 'ROOM_LOCKED');
          return;
        }
      }

      // Check participant limit
      if (room.getParticipantCount() >= MAX_ROOM_PARTICIPANTS) {
        sendError(socket, 'Room is full', 'ROOM_FULL');
        return;
      }

      // Add participant
      room.addParticipant(socket.id, { userId, displayName, role });

      // Track mappings
      socketToRoom.set(socket.id, meetingId);
      userToSocket.set(userId, socket.id);

      // Join the Socket.IO room for broadcasting
      socket.join(meetingId);

      // Send router RTP capabilities
      const rtpCapabilities = room.getRtpCapabilities();
      socket.emit('router-rtp-capabilities', { rtpCapabilities });

      // Send current participant list (excluding the joiner's full details)
      const existingParticipants = room.getParticipantInfos().filter((p) => p.socketId !== socket.id);
      socket.emit('room-joined', {
        meetingId,
        participants: existingParticipants,
        isSimulated: room.isSimulated,
        isLocked: room.isLocked,
      });

      // Notify others about the new participant
      socket.to(meetingId).emit('participant-joined', {
        socketId: socket.id,
        userId,
        displayName,
        role,
        joinedAt: Date.now(),
      });

      console.log(
        `[Signaling] ${displayName} (${socket.id}) joined room ${meetingId}. Participants: ${room.getParticipantCount()}`,
      );
    } catch (error) {
      console.error('[Signaling] Error in join-room:', error);
      sendError(socket, 'Failed to join room');
    }
  });

  // ---- leave-room ----
  socket.on('leave-room', async () => {
    await handleDisconnect(socket, 'left');
  });

  // ---- get-router-rtp-capabilities ----
  socket.on('get-router-rtp-capabilities', (payload: BasePayload) => {
    try {
      const room = roomManager.getRoom(payload?.meetingId) || getSocketRoom(socket);
      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      const rtpCapabilities = room.getRtpCapabilities();
      socket.emit('router-rtp-capabilities', { rtpCapabilities });
    } catch (error) {
      console.error('[Signaling] Error in get-router-rtp-capabilities:', error);
      sendError(socket, 'Failed to get RTP capabilities');
    }
  });

  // ---- create-transport ----
  socket.on('create-transport', async (payload: { direction: 'send' | 'recv' }) => {
    try {
      const { direction = 'send' } = payload || {};
      const room = getSocketRoom(socket);

      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      const transportInfo = await room.createWebRtcTransport(socket.id, direction);
      socket.emit('transport-created', { transportInfo, direction });
    } catch (error) {
      console.error('[Signaling] Error in create-transport:', error);
      sendError(socket, 'Failed to create transport');
    }
  });

  // ---- connect-transport ----
  socket.on('connect-transport', async (payload: { transportId: string; dtlsParameters: any }) => {
    try {
      const { transportId, dtlsParameters } = payload;
      const room = getSocketRoom(socket);

      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      await room.connectTransport(socket.id, transportId, dtlsParameters);
      socket.emit('transport-connected', { transportId });
    } catch (error) {
      console.error('[Signaling] Error in connect-transport:', error);
      sendError(socket, 'Failed to connect transport');
    }
  });

  // ---- produce ----
  socket.on('produce', async (payload: { kind: 'audio' | 'video'; rtpParameters: any; appData?: Record<string, unknown> }) => {
    try {
      const { kind, rtpParameters, appData } = payload;
      const room = getSocketRoom(socket);

      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      const result = await room.produce(socket.id, kind, rtpParameters, appData);

      // Notify other participants about the new producer
      const meetingId = socketToRoom.get(socket.id);
      if (meetingId) {
        socket.to(meetingId).emit('new-producer', {
          producerId: result.id,
          producerSocketId: socket.id,
          kind: result.kind,
        });
      }

      socket.emit('producer-created', { producerId: result.id, kind: result.kind });
    } catch (error) {
      console.error('[Signaling] Error in produce:', error);
      sendError(socket, 'Failed to create producer');
    }
  });

  // ---- consume ----
  socket.on('consume', async (payload: { producerId: string; rtpCapabilities: any }) => {
    try {
      const { producerId, rtpCapabilities } = payload;
      const room = getSocketRoom(socket);

      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      const result = await room.consume(socket.id, producerId, rtpCapabilities);
      socket.emit('consumer-created', result);
    } catch (error) {
      console.error('[Signaling] Error in consume:', error);
      sendError(socket, `Failed to consume: ${(error as Error).message}`);
    }
  });

  // ---- pause-producer ----
  socket.on('pause-producer', (payload: { producerId: string }) => {
    try {
      const { producerId } = payload;
      const room = getSocketRoom(socket);

      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      room.pauseProducer(socket.id, producerId);

      const meetingId = socketToRoom.get(socket.id);
      if (meetingId) {
        socket.to(meetingId).emit('producer-paused', {
          producerId,
          producerSocketId: socket.id,
        });
      }
    } catch (error) {
      console.error('[Signaling] Error in pause-producer:', error);
      sendError(socket, 'Failed to pause producer');
    }
  });

  // ---- resume-producer ----
  socket.on('resume-producer', (payload: { producerId: string }) => {
    try {
      const { producerId } = payload;
      const room = getSocketRoom(socket);

      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      room.resumeProducer(socket.id, producerId);

      const meetingId = socketToRoom.get(socket.id);
      if (meetingId) {
        socket.to(meetingId).emit('producer-resumed', {
          producerId,
          producerSocketId: socket.id,
        });
      }
    } catch (error) {
      console.error('[Signaling] Error in resume-producer:', error);
      sendError(socket, 'Failed to resume producer');
    }
  });

  // ---- ping (latency measurement) ----
  socket.on('ping', (payload: { clientTimestamp: number }) => {
    const now = Date.now();
    const clientTimestamp = payload?.clientTimestamp;

    socket.emit('pong', {
      serverTimestamp: now,
      clientTimestamp,
    });

    // Calculate latency if client provided a timestamp
    if (clientTimestamp) {
      // Estimate one-way latency as half of round-trip (approximate)
      const roundTrip = now - clientTimestamp;
      const oneWayLatency = Math.round(roundTrip / 2);

      const qualityChange = connectionMonitor.recordPing(socket.id, oneWayLatency);
      if (qualityChange) {
        socket.emit('quality-update', {
          quality: qualityChange,
          avgLatency: connectionMonitor.getAverageLatency(socket.id),
          recommendedBitrate: connectionMonitor.getRecommendedBitrate(socket.id),
        });

        // Notify room about the quality change
        const meetingId = socketToRoom.get(socket.id);
        if (meetingId) {
          socket.to(meetingId).emit('participant-quality-changed', {
            socketId: socket.id,
            quality: qualityChange,
          });
        }
      }
    }
  });

  // ---- request-quality ----
  socket.on('request-quality', () => {
    const quality = connectionMonitor.getQuality(socket.id);
    const stats = connectionMonitor.getConnectionStats(socket.id);

    socket.emit('quality-update', {
      quality,
      avgLatency: stats?.avgLatency ?? -1,
      recommendedBitrate: connectionMonitor.getRecommendedBitrate(socket.id),
      sampleCount: stats?.sampleCount ?? 0,
    });
  });

  // ---- kick-participant (host only) ----
  socket.on('kick-participant', (payload: { targetSocketId: string; reason?: string }) => {
    try {
      const { targetSocketId, reason } = payload;
      const room = getSocketRoom(socket);

      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      if (!isHost(socket, room)) {
        sendError(socket, 'Only the host can kick participants', 'NOT_AUTHORIZED');
        return;
      }

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (!targetSocket) {
        sendError(socket, 'Participant not found');
        return;
      }

      // Notify the kicked participant
      targetSocket.emit('participant-kicked', {
        reason: reason || 'You have been removed from the meeting',
        kickedBy: socket.id,
      });

      // Remove and notify
      targetSocket.leave(socketToRoom.get(socket.id) || '');
      handleSocketRemoval(targetSocketId, 'kicked');

      console.log(`[Signaling] Participant ${targetSocketId} kicked from room`);
    } catch (error) {
      console.error('[Signaling] Error in kick-participant:', error);
      sendError(socket, 'Failed to kick participant');
    }
  });

  // ---- mute-participant (host only) ----
  socket.on('mute-participant', (payload: { targetSocketId: string }) => {
    try {
      const { targetSocketId } = payload;
      const room = getSocketRoom(socket);

      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      if (!isHost(socket, room)) {
        sendError(socket, 'Only the host can mute participants', 'NOT_AUTHORIZED');
        return;
      }

      const targetParticipant = room.getParticipant(targetSocketId);
      if (!targetParticipant) {
        sendError(socket, 'Participant not found');
        return;
      }

      // Pause all their producers
      const producerIds = room.getProducerIds(targetSocketId);
      for (const producerId of producerIds) {
        room.pauseProducer(targetSocketId, producerId);
      }

      // Notify the muted participant
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      targetSocket?.emit('participant-muted', {
        mutedBy: socket.id,
        producerIds,
      });

      // Notify everyone
      const meetingId = socketToRoom.get(socket.id);
      if (meetingId) {
        io.to(meetingId).emit('producer-paused', {
          producerIds,
          producerSocketId: targetSocketId,
          mutedByHost: true,
        });
      }

      console.log(`[Signaling] Participant ${targetSocketId} muted by host`);
    } catch (error) {
      console.error('[Signaling] Error in mute-participant:', error);
      sendError(socket, 'Failed to mute participant');
    }
  });

  // ---- lock-room / unlock-room (host only) ----
  socket.on('lock-room', () => {
    try {
      const room = getSocketRoom(socket);
      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      if (!isHost(socket, room)) {
        sendError(socket, 'Only the host can lock the room', 'NOT_AUTHORIZED');
        return;
      }

      room.isLocked = true;
      const meetingId = socketToRoom.get(socket.id);
      if (meetingId) {
        io.to(meetingId).emit('room-locked', { lockedBy: socket.id });
      }
    } catch (error) {
      console.error('[Signaling] Error in lock-room:', error);
      sendError(socket, 'Failed to lock room');
    }
  });

  socket.on('unlock-room', () => {
    try {
      const room = getSocketRoom(socket);
      if (!room) {
        sendError(socket, 'Not in a room', 'NOT_IN_ROOM');
        return;
      }

      if (!isHost(socket, room)) {
        sendError(socket, 'Only the host can unlock the room', 'NOT_AUTHORIZED');
        return;
      }

      room.isLocked = false;
      const meetingId = socketToRoom.get(socket.id);
      if (meetingId) {
        io.to(meetingId).emit('room-unlocked', { unlockedBy: socket.id });
      }
    } catch (error) {
      console.error('[Signaling] Error in unlock-room:', error);
      sendError(socket, 'Failed to unlock room');
    }
  });

  // ---- reconnect ----
  socket.on('reconnect', async (payload: JoinRoomPayload) => {
    try {
      const { meetingId, userId, displayName, role = 'participant' } = payload;

      if (!meetingId || !userId) {
        sendError(socket, 'Missing required fields for reconnect');
        return;
      }

      // Check if the user has a pending reconnect
      const previousSocketId = userToSocket.get(userId);
      if (previousSocketId && reconnectTimers.has(previousSocketId)) {
        // Cancel the reconnect timer
        clearTimeout(reconnectTimers.get(previousSocketId)!);
        reconnectTimers.delete(previousSocketId);

        // Clean up old socket mapping
        socketToRoom.delete(previousSocketId);
        connectionMonitor.removeConnection(previousSocketId);

        // Get the room
        const room = roomManager.getRoom(meetingId);
        if (!room) {
          sendError(socket, 'Room no longer exists', 'ROOM_NOT_FOUND');
          return;
        }

        // Re-add participant
        room.addParticipant(socket.id, { userId, displayName, role });
        socketToRoom.set(socket.id, meetingId);
        userToSocket.set(userId, socket.id);
        socket.join(meetingId);

        // Send state restoration
        const rtpCapabilities = room.getRtpCapabilities();
        const existingParticipants = room.getParticipantInfos().filter((p) => p.socketId !== socket.id);

        socket.emit('reconnected', {
          meetingId,
          participants: existingParticipants,
          rtpCapabilities,
          isSimulated: room.isSimulated,
          isLocked: room.isLocked,
        });

        // Notify others
        socket.to(meetingId).emit('participant-rejoined', {
          socketId: socket.id,
          userId,
          displayName,
          role,
        });

        console.log(`[Signaling] User ${userId} reconnected successfully as ${socket.id}`);
      } else {
        // No pending reconnect - treat as a fresh join
        sendError(socket, 'No pending reconnect found. Please join the room normally.', 'NO_RECONNECT');
      }
    } catch (error) {
      console.error('[Signaling] Error in reconnect:', error);
      sendError(socket, 'Failed to reconnect');
    }
  });

  // ---- disconnect ----
  socket.on('disconnect', () => {
    handleDisconnectWithTimeout(socket);
  });

  // ---- error handler ----
  socket.on('error', (error: Error) => {
    console.error(`[Signaling] Socket error (${socket.id}):`, error.message);
  });
});

// ========================
// Disconnect Handling
// ========================

/**
 * Handle disconnect with a timeout for reconnect.
 * Sets a 30-second timer before fully removing the participant.
 */
function handleDisconnectWithTimeout(socket: Socket): void {
  const meetingId = socketToRoom.get(socket.id);

  if (!meetingId) {
    // Not in any room, just clean up
    connectionMonitor.removeConnection(socket.id);
    console.log(`[Signaling] Socket disconnected (not in room): ${socket.id}`);
    return;
  }

  const room = roomManager.getRoom(meetingId);
  const participant = room?.getParticipant(socket.id);
  const userId = participant?.userId;

  // Notify room immediately that participant disconnected
  socket.to(meetingId).emit('participant-disconnected', {
    socketId: socket.id,
    userId,
    displayName: participant?.displayName,
  });

  // Set a timer for full removal (allows reconnect)
  const timer = setTimeout(() => {
    // Check if the participant has reconnected (new socket under same userId)
    const currentSocketId = userId ? userToSocket.get(userId) : null;
    if (currentSocketId && currentSocketId !== socket.id) {
      // User reconnected with a new socket, no need to remove
      console.log(`[Signaling] User ${userId} reconnected as ${currentSocketId}, skipping removal`);
    } else {
      // Full removal
      handleDisconnect(socket, 'disconnected');
    }
  }, RECONNECT_TIMEOUT_MS);

  reconnectTimers.set(socket.id, timer);
  console.log(
    `[Signaling] Socket disconnected: ${socket.id}. Reconnect timer set for ${RECONNECT_TIMEOUT_MS / 1000}s`,
  );
}

/**
 * Handle full disconnect or explicit leave - remove participant from room.
 */
async function handleDisconnect(socket: Socket, reason: string): Promise<void> {
  const meetingId = socketToRoom.get(socket.id);

  if (!meetingId) return;

  const room = roomManager.getRoom(meetingId);
  if (!room) {
    socketToRoom.delete(socket.id);
    return;
  }

  const participant = room.getParticipant(socket.id);
  const userId = participant?.userId;

  // Notify others
  socket.to(meetingId).emit('participant-left', {
    socketId: socket.id,
    userId,
    displayName: participant?.displayName,
    reason,
  });

  // Remove from room
  await room.removeParticipant(socket.id);

  // Clean up mappings
  socketToRoom.delete(socket.id);
  connectionMonitor.removeConnection(socket.id);

  if (userId) {
    userToSocket.delete(userId);
  }

  // Clear reconnect timer if exists
  if (reconnectTimers.has(socket.id)) {
    clearTimeout(reconnectTimers.get(socket.id)!);
    reconnectTimers.delete(socket.id);
  }

  // Leave Socket.IO room
  socket.leave(meetingId);

  // Close room if empty
  if (room.getParticipantCount() === 0) {
    console.log(`[Signaling] Room ${meetingId} is empty, scheduling cleanup`);
    // Don't close immediately - keep room alive for a bit in case participants rejoin
    setTimeout(async () => {
      const currentRoom = roomManager.getRoom(meetingId);
      if (currentRoom && currentRoom.getParticipantCount() === 0) {
        await roomManager.closeRoom(meetingId);
      }
    }, 60_000);
  }

  console.log(
    `[Signaling] ${participant?.displayName || socket.id} ${reason} room ${meetingId}. Remaining: ${room.getParticipantCount()}`,
  );
}

/**
 * Force-remove a socket's room state (for kick operations).
 */
function handleSocketRemoval(socketId: string, reason: string): void {
  const meetingId = socketToRoom.get(socketId);
  if (!meetingId) return;

  const room = roomManager.getRoom(meetingId);
  const participant = room?.getParticipant(socketId);

  if (room) {
    // Notify others
    io.to(meetingId).emit('participant-left', {
      socketId,
      userId: participant?.userId,
      displayName: participant?.displayName,
      reason,
    });

    // Remove from room (fire and forget)
    room.removeParticipant(socketId).catch((err) => {
      console.error(`[Signaling] Error removing kicked participant:`, err);
    });
  }

  // Clean up mappings
  socketToRoom.delete(socketId);
  connectionMonitor.removeConnection(socketId);

  if (participant?.userId) {
    userToSocket.delete(participant.userId);
  }

  // Clear reconnect timer
  if (reconnectTimers.has(socketId)) {
    clearTimeout(reconnectTimers.get(socketId)!);
    reconnectTimers.delete(socketId);
  }
}

// ========================
// Periodic Cleanup
// ========================

// Clean up stale rooms every 5 minutes
setInterval(() => {
  const stats = roomManager.getRoomStats();
  const now = Date.now();

  for (const roomStat of stats) {
    // Close rooms that have been empty for more than 10 minutes
    if (roomStat.participantCount === 0 && now - roomStat.createdAt > 600_000) {
      roomManager.closeRoom(roomStat.meetingId).catch(console.error);
    }
  }
}, 300_000);

// ========================
// Start Server
// ========================

httpServer.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════════╗`);
  console.log(`║  MeetLive Signaling Service              ║`);
  console.log(`║  Running on port ${PORT}                     ║`);
  console.log(`║  Socket.IO path: /                        ║`);
  console.log(`║  Reconnect timeout: ${RECONNECT_TIMEOUT_MS / 1000}s                  ║`);
  console.log(`║  Max participants per room: ${MAX_ROOM_PARTICIPANTS}            ║`);
  console.log(`╚══════════════════════════════════════════╝`);
});

// ========================
// Graceful Shutdown
// ========================

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Signaling] Received ${signal}, shutting down...`);

  // Close all reconnect timers
  for (const [socketId, timer] of reconnectTimers) {
    clearTimeout(timer);
  }
  reconnectTimers.clear();

  // Close all rooms
  const stats = roomManager.getRoomStats();
  for (const roomStat of stats) {
    await roomManager.closeRoom(roomStat.meetingId);
  }

  // Close HTTP server
  httpServer.close(() => {
    console.log('[Signaling] Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[Signaling] Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
