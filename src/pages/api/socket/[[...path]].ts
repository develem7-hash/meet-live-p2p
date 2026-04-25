import { Server as NetServer } from 'http';
import { NextApiRequest, NextApiResponse } from 'next';
import { Server as ServerIO } from 'socket.io';
import * as mediasoupSetup from '@/server/mediasoup';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Use global to persist across hot-reloads in development
const globalAny: any = global;
if (!globalAny.rooms) {
  globalAny.rooms = new Map();
}

const rooms = globalAny.rooms;

export default async function ioHandler(req: NextApiRequest, res: NextApiResponse) {
  if (!(res.socket as any).server.io) {
    console.log('*First use, starting socket.io');

    try {
      if (!globalAny.workersCreated) {
        await mediasoupSetup.createWorkers(1);
        globalAny.workersCreated = true;
      }
    } catch (e) {
      console.log('Mediasoup workers already created or error:', e);
    }

    const httpServer: NetServer = (res.socket as any).server as any;
    const io = new ServerIO(httpServer, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: { origin: '*' }
    });

    io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      let currentMeetingId: string | null = null;
      let currentParticipantId: string | null = null;

      // Join meeting
      socket.on('join-room', async ({ meetingId, participantId }, callback) => {
        console.log(`User ${participantId} joining room ${meetingId}`);
        currentMeetingId = meetingId;
        currentParticipantId = participantId;

        if (!rooms.has(meetingId)) {
          const worker = mediasoupSetup.getWorker();
          const router = await worker.createRouter({ mediaCodecs: mediasoupSetup.config.router.mediaCodecs });
          rooms.set(meetingId, { router, peers: new Map() });
        }

        const room = rooms.get(meetingId);
        if (!room.peers.has(participantId)) {
          room.peers.set(participantId, {
            socket,
            transports: new Map(),
            producers: new Map(),
            consumers: new Map(),
          });
        }

        socket.join(meetingId);

        const rtpCapabilities = room.router.rtpCapabilities;
        callback({ rtpCapabilities });
      });

      // Create WebRTC Transport
      socket.on('create-webrtc-transport', async ({ direction, meetingId, participantId }, callback) => {
        try {
          const room = rooms.get(meetingId);
          const transport = await room.router.createWebRtcTransport(mediasoupSetup.config.webRtcTransport);

          transport.on('dtlsstatechange', (dtlsState: string) => {
            if (dtlsState === 'closed') transport.close();
          });

          transport.on('close', () => {
            console.log('transport closed');
          });

          const peer = room.peers.get(participantId);
          peer.transports.set(transport.id, transport);

          callback({
            params: {
              id: transport.id,
              iceParameters: transport.iceParameters,
              iceCandidates: transport.iceCandidates,
              dtlsParameters: transport.dtlsParameters,
            },
          });
        } catch (err: any) {
          console.error(err);
          callback({ error: err.message });
        }
      });

      // Connect WebRTC Transport
      socket.on('connect-transport', async ({ meetingId, participantId, transportId, dtlsParameters }, callback) => {
        try {
          const room = rooms.get(meetingId);
          const peer = room.peers.get(participantId);
          const transport = peer.transports.get(transportId);

          await transport.connect({ dtlsParameters });
          callback();
        } catch (err: any) {
          console.error(err);
          callback({ error: err.message });
        }
      });

      // Produce media
      socket.on('produce', async ({ meetingId, participantId, transportId, kind, rtpParameters, appData }, callback) => {
        try {
          const room = rooms.get(meetingId);
          const peer = room.peers.get(participantId);
          const transport = peer.transports.get(transportId);

          const producer = await transport.produce({ kind, rtpParameters, appData });

          peer.producers.set(producer.id, producer);

          producer.on('transportclose', () => {
            producer.close();
            peer.producers.delete(producer.id);
          });

          // Inform other peers in the room about the new producer
          socket.to(meetingId).emit('new-producer', {
            producerId: producer.id,
            participantId,
            kind: producer.kind,
          });

          callback({ id: producer.id });
        } catch (err: any) {
          console.error(err);
          callback({ error: err.message });
        }
      });

      // Consume media
      socket.on('consume', async ({ meetingId, participantId, transportId, producerId, rtpCapabilities }, callback) => {
        try {
          const room = rooms.get(meetingId);
          if (!room.router.canConsume({ producerId, rtpCapabilities })) {
            return callback({ error: 'cannot consume' });
          }

          const peer = room.peers.get(participantId);
          const transport = peer.transports.get(transportId);

          const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: true, // start paused, then client unpauses
          });

          peer.consumers.set(consumer.id, consumer);

          consumer.on('transportclose', () => {
            peer.consumers.delete(consumer.id);
          });

          consumer.on('producerclose', () => {
            peer.consumers.delete(consumer.id);
            socket.emit('producer-closed', { producerId });
          });

          callback({
            params: {
              id: consumer.id,
              producerId: consumer.producerId,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
            },
          });
        } catch (err: any) {
          console.error(err);
          callback({ error: err.message });
        }
      });

      // Unpause consumer
      socket.on('resume-consumer', async ({ meetingId, participantId, consumerId }, callback) => {
        try {
          const room = rooms.get(meetingId);
          const peer = room.peers.get(participantId);
          const consumer = peer.consumers.get(consumerId);

          await consumer.resume();
          callback();
        } catch (err: any) {
          console.error(err);
          callback({ error: err.message });
        }
      });

      // Get existing producers in the room
      socket.on('get-producers', ({ meetingId, participantId }, callback) => {
        try {
          const room = rooms.get(meetingId);
          const producerList = [];

          for (const [peerId, peer] of room.peers.entries()) {
            if (peerId !== participantId) {
              for (const producer of peer.producers.values()) {
                producerList.push({
                  producerId: producer.id,
                  participantId: peerId,
                  kind: producer.kind,
                });
              }
            }
          }

          callback(producerList);
        } catch (err) {
          console.error(err);
          callback([]);
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
        if (currentMeetingId && currentParticipantId) {
          const room = rooms.get(currentMeetingId);
          if (room) {
            const peer = room.peers.get(currentParticipantId);
            if (peer) {
              // Close transports
              for (const transport of peer.transports.values()) {
                transport.close();
              }
              room.peers.delete(currentParticipantId);
            }

            socket.to(currentMeetingId).emit('peer-left', { participantId: currentParticipantId });

            if (room.peers.size === 0) {
              room.router.close();
              rooms.delete(currentMeetingId);
            }
          }
        }
      });

      // Close a specific producer
      socket.on('close-producer', ({ meetingId, participantId, producerId }) => {
        try {
          const room = rooms.get(meetingId);
          if (room) {
            const peer = room.peers.get(participantId);
            if (peer && peer.producers.has(producerId)) {
              const producer = peer.producers.get(producerId);
              producer.close();
              peer.producers.delete(producerId);
              // Notify others
              socket.to(meetingId).emit('producer-closed', { producerId });
            }
          }
        } catch (err) {
          console.error('Error closing producer:', err);
        }
      });

      // Chat functionality
      socket.on('send-message', ({ meetingId, senderName, text }, callback) => {
        try {
          const message = {
            id: Math.random().toString(36).substring(7),
            senderId: currentParticipantId,
            senderName,
            text,
            timestamp: new Date().toISOString(),
          };
          socket.to(meetingId).emit('chat-message', message);
          callback({ message });
        } catch (err: any) {
          console.error('Error sending message:', err);
          callback({ error: err.message });
        }
      });
    });

    (res.socket as any).server.io = io;
  }
  res.end();
}
