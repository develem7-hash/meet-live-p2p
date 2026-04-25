import Peer, { MediaConnection, DataConnection } from 'peerjs';

export class WebRTCClient {
  private peer: Peer | null = null;
  private meetingId: string;
  private participantId: string;
  
  public localStream: MediaStream | null = null;
  public localScreenStream: MediaStream | null = null;
  public remoteStreams: Map<string, MediaStream> = new Map();
  public remoteScreenStreams: Map<string, MediaStream> = new Map();
  
  private connections: Map<string, MediaConnection> = new Map();
  private screenConnections: Map<string, MediaConnection> = new Map();
  private dataConnections: Map<string, DataConnection> = new Map();

  // Callbacks
  public onLocalStream?: (stream: MediaStream) => void;
  public onLocalScreenShareChange?: (stream: MediaStream | null) => void;
  public onRemoteStreamAdd?: (participantId: string, stream: MediaStream, type: 'video' | 'screen') => void;
  public onRemoteStreamRemove?: (participantId: string, type: 'video' | 'screen') => void;
  public onChatMessage?: (message: any) => void;

  constructor(meetingId: string, participantId: string) {
    this.meetingId = meetingId;
    this.participantId = participantId;
  }

  public async startLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      this.localStream = stream;
      if (this.onLocalStream) this.onLocalStream(stream);
    } catch (err) {
      console.error('Failed to get local media', err);
      throw err;
    }
  }

  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Initialize PeerJS
      // We use the participantId as the Peer ID for easy lookup
      this.peer = new Peer(this.participantId, {
        debug: 2,
      });

      this.peer.on('open', (id) => {
        console.log('PeerJS connected with ID:', id);
        this.setupEventListeners();
        resolve();
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        reject(err);
      });
    });
  }

  private setupEventListeners() {
    if (!this.peer) return;

    // Handle incoming calls (Video/Audio)
    this.peer.on('call', (call) => {
      console.log('Incoming call from:', call.peer);
      
      // Check if it's a screen share or video (we can pass metadata in PeerJS using metadata option)
      const isScreen = call.metadata?.type === 'screen';
      
      call.answer(isScreen ? undefined : (this.localStream || undefined));
      
      call.on('stream', (remoteStream) => {
        console.log('Received remote stream from:', call.peer, 'type:', isScreen ? 'screen' : 'video');
        if (isScreen) {
          this.remoteScreenStreams.set(call.peer, remoteStream);
          if (this.onRemoteStreamAdd) this.onRemoteStreamAdd(call.peer, remoteStream, 'screen');
        } else {
          this.remoteStreams.set(call.peer, remoteStream);
          if (this.onRemoteStreamAdd) this.onRemoteStreamAdd(call.peer, remoteStream, 'video');
        }
      });

      call.on('close', () => {
        this.handlePeerDisconnect(call.peer);
      });
    });

    // Handle incoming data connections (Chat)
    this.peer.on('connection', (conn) => {
      this.setupDataConnection(conn);
    });
  }

  private setupDataConnection(conn: DataConnection) {
    this.dataConnections.set(conn.peer, conn);
    
    conn.on('data', (data: any) => {
      if (data.type === 'chat' && this.onChatMessage) {
        this.onChatMessage(data.message);
      }
    });

    conn.on('close', () => {
      this.dataConnections.delete(conn.peer);
    });
  }

  public async callPeer(targetParticipantId: string) {
    if (!this.peer || !this.localStream || targetParticipantId === this.participantId) return;

    console.log('Calling peer:', targetParticipantId);

    // 1. Audio/Video Call
    const call = this.peer.call(targetParticipantId, this.localStream, {
      metadata: { type: 'video' }
    });
    
    call.on('stream', (remoteStream) => {
      this.remoteStreams.set(targetParticipantId, remoteStream);
      if (this.onRemoteStreamAdd) this.onRemoteStreamAdd(targetParticipantId, remoteStream, 'video');
    });

    this.connections.set(targetParticipantId, call);

    // 2. Data Connection (Chat)
    const conn = this.peer.connect(targetParticipantId);
    this.setupDataConnection(conn);

    // 3. If we are already screen sharing, call them with the screen stream too
    if (this.localScreenStream) {
      const screenCall = this.peer.call(targetParticipantId, this.localScreenStream, {
        metadata: { type: 'screen' }
      });
      this.screenConnections.set(targetParticipantId, screenCall);
    }
  }

  private handlePeerDisconnect(pid: string) {
    this.remoteStreams.delete(pid);
    this.remoteScreenStreams.delete(pid);
    this.connections.delete(pid);
    this.screenConnections.delete(pid);
    this.dataConnections.delete(pid);
    
    if (this.onRemoteStreamRemove) {
      this.onRemoteStreamRemove(pid, 'video');
      this.onRemoteStreamRemove(pid, 'screen');
    }
  }

  public async startScreenShare(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      this.localScreenStream = stream;
      
      // Call everyone with the screen stream
      this.dataConnections.forEach((conn, pid) => {
        if (this.peer && this.localScreenStream) {
          const call = this.peer.call(pid, this.localScreenStream, {
            metadata: { type: 'screen' }
          });
          this.screenConnections.set(pid, call);
        }
      });

      if (this.onLocalScreenShareChange) {
        this.onLocalScreenShareChange(this.localScreenStream);
      }

      stream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare();
      };

      return true;
    } catch (err) {
      console.error('Failed to start screen share', err);
      return false;
    }
  }

  public stopScreenShare() {
    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach(t => t.stop());
      this.localScreenStream = null;
    }
    
    this.screenConnections.forEach(call => call.close());
    this.screenConnections.clear();

    if (this.onLocalScreenShareChange) {
      this.onLocalScreenShareChange(null);
    }
  }

  public toggleMute(): boolean {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return !audioTrack.enabled;
      }
    }
    return false;
  }

  public toggleVideo(): boolean {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return !videoTrack.enabled;
      }
    }
    return false;
  }

  public sendMessage(text: string, senderName: string) {
    const message = {
      id: Math.random().toString(36).substring(7),
      senderId: this.participantId,
      senderName,
      text,
      timestamp: new Date().toISOString(),
    };

    this.dataConnections.forEach((conn) => {
      conn.send({ type: 'chat', message });
    });
  }

  public disconnect() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.localStream?.getTracks().forEach(t => t.stop());
    this.localScreenStream?.getTracks().forEach(t => t.stop());
  }
}
