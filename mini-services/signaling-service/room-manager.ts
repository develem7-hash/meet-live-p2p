// Room management class
// - Creates/manages mediasoup routers per meeting room
// - Tracks transports, producers, consumers per participant
// - Handles room lifecycle (create, join, leave, close)
// - Supports audio-first with graceful degradation
// - Falls back to simulated mode if mediasoup is unavailable

import * as mediasoup from 'mediasoup';
import type { Router, WebRtcTransport, Producer, Consumer, RtpCapabilities, RtpParameters, DtlsParameters } from 'mediasoup/node/lib/types';
import { mediasoupConfig, bandwidthProfiles } from './mediasoup-config.js';

// ========================
// Types
// ========================

export interface ParticipantInfo {
  socketId: string;
  userId: string;
  displayName: string;
  role: 'host' | 'co_host' | 'participant';
  isMuted: boolean;
  joinedAt: number;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
  transport?: WebRtcTransport;
  producerTransport?: WebRtcTransport;
  consumerTransport?: WebRtcTransport;
}

export interface RoomState {
  meetingId: string;
  participantCount: number;
  isLocked: boolean;
  isSimulated: boolean;
  createdAt: number;
}

// ========================
// Room Class
// ========================

export class Room {
  readonly meetingId: string;
  readonly createdAt: number;
  isLocked = false;
  isSimulated = false;

  private participants = new Map<string, ParticipantInfo>();
  private router!: Router;
  private workers: mediasoup.types.Worker[] = [];

  constructor(
    meetingId: string,
    private readonly onParticipantLeft?: (meetingId: string, socketId: string, info: ParticipantInfo) => void,
  ) {
    this.meetingId = meetingId;
    this.createdAt = Date.now();
  }

  /**
   * Initialize the mediasoup router. Falls back to simulated mode on failure.
   */
  async init(): Promise<void> {
    try {
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: 20000,
        rtcMaxPort: 40000,
      });

      this.workers.push(worker);

      worker.on('died', () => {
        console.error(`[Room ${this.meetingId}] mediasoup worker died`);
        // Attempt recovery in simulated mode
        this.isSimulated = true;
      });

      this.router = await worker.createRouter({
        mediaCodecs: mediasoupConfig.router.mediaCodecs as mediasoup.types.RtpCodec[],
      });

      console.log(`[Room ${this.meetingId}] Router created (mediasoup mode)`);
    } catch (error) {
      console.warn(
        `[Room ${this.meetingId}] mediasoup unavailable, running in simulated mode. Error: ${(error as Error).message}`,
      );
      this.isSimulated = true;
    }
  }

  /**
   * Add a participant to the room.
   */
  addParticipant(socketId: string, info: Omit<ParticipantInfo, 'socketId' | 'producers' | 'consumers' | 'joinedAt'>): ParticipantInfo {
    const participant: ParticipantInfo = {
      socketId,
      ...info,
      isMuted: info.isMuted ?? false,
      joinedAt: Date.now(),
      producers: new Map(),
      consumers: new Map(),
    };

    this.participants.set(socketId, participant);
    return participant;
  }

  /**
   * Remove a participant and clean up all their resources.
   */
  async removeParticipant(socketId: string): Promise<ParticipantInfo | null> {
    const participant = this.participants.get(socketId);
    if (!participant) return null;

    // Close all consumers
    for (const [, consumer] of participant.consumers) {
      try {
        consumer.close();
      } catch {
        // Consumer may already be closed
      }
    }

    // Close all producers
    for (const [producerId, producer] of participant.producers) {
      try {
        producer.close();
      } catch {
        // Producer may already be closed
      }

      // Notify other participants that this producer is gone
      this.notifyProducerClosed(socketId, producerId);
    }

    // Close transports
    if (participant.producerTransport) {
      try {
        participant.producerTransport.close();
      } catch {
        // Transport may already be closed
      }
    }
    if (participant.consumerTransport) {
      try {
        participant.consumerTransport.close();
      } catch {
        // Transport may already be closed
      }
    }

    this.participants.delete(socketId);

    // Remove all consumers from other participants that consume this participant's producers
    for (const [, otherParticipant] of this.participants) {
      for (const [consumerId, consumer] of otherParticipant.consumers) {
        if (consumer.appData?.producerSocketId === socketId) {
          try {
            consumer.close();
          } catch {
            // Already closed
          }
          otherParticipant.consumers.delete(consumerId);
        }
      }
    }

    this.onParticipantLeft?.(this.meetingId, socketId, participant);
    return participant;
  }

  /**
   * Get RTP capabilities from the router.
   */
  getRtpCapabilities(): RtpCapabilities | null {
    if (this.isSimulated) {
      return {
        codecs: [
          {
            mimeType: 'audio/opus',
            clockRate: 48000,
            channels: 2,
            parameters: {
              useinbandfec: 1,
              usedtx: 1,
            },
          },
        ],
        headerExtensions: [],
        fecMechanisms: [],
      };
    }
    return this.router.rtpCapabilities;
  }

  /**
   * Create a WebRTC transport for a participant.
   */
  async createWebRtcTransport(socketId: string, direction: 'send' | 'recv'): Promise<{
    id: string;
    iceParameters: mediasoup.types.IceParameters;
    iceCandidates: mediasoup.types.IceCandidate[];
    dtlsParameters: mediasoup.types.DtlsParameters;
  }> {
    const participant = this.participants.get(socketId);
    if (!participant) {
      throw new Error('Participant not found in room');
    }

    if (this.isSimulated) {
      // Return simulated transport params
      const transportId = `sim-${direction}-${Date.now()}`;
      return {
        id: transportId,
        iceParameters: {
          usernameFragment: 'sim-frag',
          password: 'sim-password',
          iceLite: true,
        },
        iceCandidates: [
          {
            foundation: 'udp',
            priority: 1076302079,
            ip: '127.0.0.1',
            protocol: 'udp',
            port: 44444,
            type: 'host',
            component: 1,
          },
        ],
        dtlsParameters: {
          role: 'auto',
          fingerprints: [
            {
              algorithm: 'sha-256',
              value: '00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
            },
          ],
        },
      };
    }

    const transport = await this.router.createWebRtcTransport({
      listenIps: mediasoupConfig.webRtcTransport.listenIps as { ip: string; announcedIp?: string }[],
      enableUdp: mediasoupConfig.webRtcTransport.enableUdp,
      enableTcp: mediasoupConfig.webRtcTransport.enableTcp,
      preferUdp: mediasoupConfig.webRtcTransport.preferUdp,
      initialAvailableOutgoingBitrate: mediasoupConfig.webRtcTransport.initialAvailableOutgoingBitrate,
    });

    // Store transport on the participant
    if (direction === 'send') {
      participant.producerTransport = transport;
    } else {
      participant.consumerTransport = transport;
    }

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed' || dtlsState === 'failed') {
        console.log(`[Room ${this.meetingId}] Transport ${transport.id} DTLS ${dtlsState}`);
      }
    });

    transport.on('close', () => {
      console.log(`[Room ${this.meetingId}] Transport ${transport.id} closed`);
    });

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  /**
   * Connect a transport with DTLS parameters.
   */
  async connectTransport(socketId: string, transportId: string, dtlsParameters: DtlsParameters): Promise<void> {
    const participant = this.participants.get(socketId);
    if (!participant) throw new Error('Participant not found');

    if (this.isSimulated) return; // No-op in simulated mode

    const transport =
      (participant.producerTransport?.id === transportId ? participant.producerTransport : null) ??
      (participant.consumerTransport?.id === transportId ? participant.consumerTransport : null);

    if (!transport) {
      throw new Error(`Transport ${transportId} not found for participant ${socketId}`);
    }

    await transport.connect({ dtlsParameters });
  }

  /**
   * Create an audio producer for a participant.
   */
  async produce(
    socketId: string,
    kind: 'audio' | 'video',
    rtpParameters: RtpParameters,
    appData?: Record<string, unknown>,
  ): Promise<{ id: string; kind: string }> {
    const participant = this.participants.get(socketId);
    if (!participant) throw new Error('Participant not found');

    if (this.isSimulated) {
      const producerId = `sim-producer-${Date.now()}`;
      // Store a simulated producer entry
      participant.producers.set(producerId, {
        id: producerId,
        kind,
        closed: false,
        appData: { ...appData, simulated: true },
      } as unknown as Producer);
      return { id: producerId, kind };
    }

    if (!participant.producerTransport) {
      throw new Error('Producer transport not created. Call createWebRtcTransport with direction="send" first.');
    }

    const producer = await participant.producerTransport.produce({
      kind,
      rtpParameters,
      appData: { ...appData, producerSocketId: socketId },
      codecOptions: mediasoupConfig.producer.codecOptions,
    });

    participant.producers.set(producer.id, producer);

    producer.on('transportclose', () => {
      participant.producers.delete(producer.id);
    });

    return { id: producer.id, kind };
  }

  /**
   * Create a consumer for another participant's producer.
   */
  async consume(
    socketId: string,
    producerId: string,
    rtpCapabilities: RtpCapabilities,
  ): Promise<{
    id: string;
    producerId: string;
    kind: string;
    rtpParameters: RtpParameters;
    producerSocketId: string;
  }> {
    const participant = this.participants.get(socketId);
    if (!participant) throw new Error('Participant not found');

    if (this.isSimulated) {
      const consumerId = `sim-consumer-${Date.now()}`;
      return {
        id: consumerId,
        producerId,
        kind: 'audio',
        rtpParameters: {},
        producerSocketId: 'simulated',
      };
    }

    if (!participant.consumerTransport) {
      throw new Error('Consumer transport not created. Call createWebRtcTransport with direction="recv" first.');
    }

    // Find the producer across all participants
    let targetProducer: Producer | null = null;
    let producerSocketId = '';

    for (const [pSocketId, p] of this.participants) {
      const prod = p.producers.get(producerId);
      if (prod) {
        targetProducer = prod;
        producerSocketId = pSocketId;
        break;
      }
    }

    if (!targetProducer) {
      throw new Error(`Producer ${producerId} not found in any participant`);
    }

    if (!this.router.canConsume({ producerId: targetProducer.id, rtpCapabilities })) {
      throw new Error('Cannot consume this producer with the given RTP capabilities');
    }

    const consumer = await participant.consumerTransport.consume({
      producerId: targetProducer.id,
      rtpCapabilities,
      paused: mediasoupConfig.consumer.paused,
      appData: { producerSocketId },
    });

    participant.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      participant.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      participant.consumers.delete(consumer.id);
    });

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      producerSocketId,
    };
  }

  /**
   * Pause a producer (mute the participant).
   */
  pauseProducer(socketId: string, producerId: string): void {
    const participant = this.participants.get(socketId);
    if (!participant) throw new Error('Participant not found');

    const producer = participant.producers.get(producerId);
    if (!producer) throw new Error(`Producer ${producerId} not found`);

    if (!this.isSimulated) {
      producer.pause();
    }

    participant.isMuted = true;
  }

  /**
   * Resume a producer (unmute the participant).
   */
  resumeProducer(socketId: string, producerId: string): void {
    const participant = this.participants.get(socketId);
    if (!participant) throw new Error('Participant not found');

    const producer = participant.producers.get(producerId);
    if (!producer) throw new Error(`Producer ${producerId} not found`);

    if (!this.isSimulated) {
      producer.resume();
    }

    participant.isMuted = false;
  }

  /**
   * Get participant count.
   */
  getParticipantCount(): number {
    return this.participants.size;
  }

  /**
   * Check if a participant exists.
   */
  hasParticipant(socketId: string): boolean {
    return this.participants.has(socketId);
  }

  /**
   * Get a specific participant.
   */
  getParticipant(socketId: string): ParticipantInfo | undefined {
    return this.participants.get(socketId);
  }

  /**
   * Get info about all participants (safe for sending to clients).
   */
  getParticipantInfos(): Array<{
    socketId: string;
    userId: string;
    displayName: string;
    role: string;
    isMuted: boolean;
    joinedAt: number;
    producerIds: string[];
  }> {
    const infos: Array<{
      socketId: string;
      userId: string;
      displayName: string;
      role: string;
      isMuted: boolean;
      joinedAt: number;
      producerIds: string[];
    }> = [];

    for (const [socketId, p] of this.participants) {
      infos.push({
        socketId,
        userId: p.userId,
        displayName: p.displayName,
        role: p.role,
        isMuted: p.isMuted,
        joinedAt: p.joinedAt,
        producerIds: Array.from(p.producers.keys()),
      });
    }

    return infos;
  }

  /**
   * Get all producer IDs for a participant.
   */
  getProducerIds(socketId: string): string[] {
    const participant = this.participants.get(socketId);
    if (!participant) return [];
    return Array.from(participant.producers.keys());
  }

  /**
   * Get all socket IDs in the room.
   */
  getSocketIds(): string[] {
    return Array.from(this.participants.keys());
  }

  /**
   * Get the participant info for a given producer.
   */
  getParticipantByProducerId(producerId: string): ParticipantInfo | null {
    for (const [, participant] of this.participants) {
      if (participant.producers.has(producerId)) {
        return participant;
      }
    }
    return null;
  }

  /**
   * Notify all participants (except the source) about a producer closure.
   */
  private notifyProducerClosed(sourceSocketId: string, producerId: string): void {
    // Consumers referencing this producer will be cleaned up by event handlers
    console.log(`[Room ${this.meetingId}] Producer ${producerId} closed (from ${sourceSocketId})`);
  }

  /**
   * Close the room and clean up all resources.
   */
  async close(): Promise<void> {
    console.log(`[Room ${this.meetingId}] Closing room with ${this.participants.size} participants`);

    // Remove all participants
    for (const [socketId] of this.participants) {
      await this.removeParticipant(socketId);
    }

    // Close router
    try {
      this.router?.close();
    } catch {
      // Router may already be closed
    }

    // Close workers
    for (const worker of this.workers) {
      try {
        await worker.close();
      } catch {
        // Worker may already be closed
      }
    }

    this.workers = [];
  }
}

// ========================
// Room Manager (Singleton)
// ========================

export class RoomManager {
  private rooms = new Map<string, Room>();
  private static instance: RoomManager;

  private constructor() {}

  static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  /**
   * Get an existing room or create a new one.
   */
  async getOrCreateRoom(meetingId: string): Promise<Room> {
    let room = this.rooms.get(meetingId);

    if (!room) {
      room = new Room(meetingId);
      await room.init();
      this.rooms.set(meetingId, room);
      console.log(`[RoomManager] Room created: ${meetingId} (simulated: ${room.isSimulated})`);
    }

    return room;
  }

  /**
   * Get a room by meetingId.
   */
  getRoom(meetingId: string): Room | undefined {
    return this.rooms.get(meetingId);
  }

  /**
   * Close and remove a room.
   */
  async closeRoom(meetingId: string): Promise<void> {
    const room = this.rooms.get(meetingId);
    if (!room) return;

    await room.close();
    this.rooms.delete(meetingId);
    console.log(`[RoomManager] Room closed: ${meetingId}`);
  }

  /**
   * Get stats for all rooms.
   */
  getRoomStats(): Array<RoomState> {
    const stats: Array<RoomState> = [];

    for (const [, room] of this.rooms) {
      stats.push({
        meetingId: room.meetingId,
        participantCount: room.getParticipantCount(),
        isLocked: room.isLocked,
        isSimulated: room.isSimulated,
        createdAt: room.createdAt,
      });
    }

    return stats;
  }

  /**
   * Get total rooms count.
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Get total participants across all rooms.
   */
  getTotalParticipants(): number {
    let total = 0;
    for (const [, room] of this.rooms) {
      total += room.getParticipantCount();
    }
    return total;
  }
}

// Export singleton instance
export const roomManager = RoomManager.getInstance();
