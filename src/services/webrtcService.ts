// WebRTC Peer-to-Peer Service for authentic multi-tab human-to-human audio calling
// Uses unique Peer IDs & zero-server BroadcastChannel signaling + RTCPeerConnection for real two-way audio.

export type WebRtcConnectionState = 'idle' | 'calling' | 'ringing' | 'connected' | 'disconnected';

export interface PeerSignalMessage {
  type: 'peer_offer' | 'peer_answer' | 'peer_candidate' | 'peer_hangup';
  fromPeerId: string;
  targetPeerId?: string;
  callerMeta?: {
    name: string;
    phone: string;
    avatarBg?: string;
    avatarColor?: string;
  };
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export class WebRtcService {
  private peerId: string;
  private peer: RTCPeerConnection | null = null;
  private channel: BroadcastChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private connectionState: WebRtcConnectionState = 'idle';

  // Callbacks
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onOfferReceivedCallback: ((fromPeerId: string, callerMeta: any, sdp: RTCSessionDescriptionInit) => void) | null = null;
  private onStateChangeCallback: ((state: WebRtcConnectionState) => void) | null = null;

  constructor() {
    this.peerId = 'peer_' + Math.random().toString(36).slice(2, 9);

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('onground-callcentre-peer-v2');
      this.channel.onmessage = (event) => {
        this.handleSignalMessage(event.data);
      };
    }
  }

  getPeerId(): string {
    return this.peerId;
  }

  getConnectionState(): WebRtcConnectionState {
    return this.connectionState;
  }

  setCallbacks(
    onRemoteStream: (stream: MediaStream) => void,
    onOfferReceived: (fromPeerId: string, callerMeta: any, sdp: RTCSessionDescriptionInit) => void,
    onStateChange: (state: WebRtcConnectionState) => void
  ) {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onOfferReceivedCallback = onOfferReceived;
    this.onStateChangeCallback = onStateChange;
  }

  private setState(state: WebRtcConnectionState) {
    this.connectionState = state;
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(state);
    }
  }

  // Create RTCPeerConnection with Google public STUN server
  private createPeerConnection(targetPeerId?: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && this.channel) {
        this.channel.postMessage({
          type: 'peer_candidate',
          fromPeerId: this.peerId,
          targetPeerId,
          candidate: event.candidate.toJSON(),
        } as PeerSignalMessage);
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];

        // Attach to DOM audio element for real audio speaker output
        if (typeof Audio !== 'undefined') {
          try {
            if (!this.audioElement) {
              this.audioElement = new Audio();
              this.audioElement.autoplay = true;
            }
            this.audioElement.srcObject = event.streams[0];
            this.audioElement.play().catch((err) => console.warn('Audio playback error:', err));
          } catch (e) {
            console.warn('Audio attachment error:', e);
          }
        }

        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(event.streams[0]);
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        this.setState('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.setState('disconnected');
        this.closePeer();
      }
    };

    return pc;
  }

  // 1. Start Outbound Call to any available peer tab
  async startPeerCall(stream: MediaStream, callerMeta?: any) {
    this.localStream = stream;
    this.peer = this.createPeerConnection();

    // Add audio tracks from local microphone
    stream.getAudioTracks().forEach((track) => {
      this.peer?.addTrack(track, stream);
    });

    const offer = await this.peer.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await this.peer.setLocalDescription(offer);

    this.setState('calling');

    if (this.channel) {
      this.channel.postMessage({
        type: 'peer_offer',
        fromPeerId: this.peerId,
        callerMeta: callerMeta || {
          name: 'Agent (Peer Tab)',
          phone: '+91 98450 12345',
          avatarBg: '#e1f5ee',
          avatarColor: '#0f6e56',
        },
        sdp: offer,
      } as PeerSignalMessage);
    }
  }

  // 2. Accept Inbound Peer Call
  async acceptPeerCall(stream: MediaStream, fromPeerId: string, remoteOffer: RTCSessionDescriptionInit) {
    this.localStream = stream;
    this.peer = this.createPeerConnection(fromPeerId);

    stream.getAudioTracks().forEach((track) => {
      this.peer?.addTrack(track, stream);
    });

    await this.peer.setRemoteDescription(new RTCSessionDescription(remoteOffer));
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);

    this.setState('connected');

    if (this.channel) {
      this.channel.postMessage({
        type: 'peer_answer',
        fromPeerId: this.peerId,
        targetPeerId: fromPeerId,
        sdp: answer,
      } as PeerSignalMessage);
    }
  }

  // Handle Signal Message
  private async handleSignalMessage(data: PeerSignalMessage) {
    if (!data || data.fromPeerId === this.peerId) {
      // Ignore own broadcasts
      return;
    }

    if (data.type === 'peer_offer' && data.sdp) {
      if (this.onOfferReceivedCallback) {
        this.onOfferReceivedCallback(data.fromPeerId, data.callerMeta, data.sdp);
      }
    } else if (data.type === 'peer_answer' && data.sdp && this.peer) {
      if (data.targetPeerId === this.peerId) {
        await this.peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
        this.setState('connected');
      }
    } else if (data.type === 'peer_candidate' && data.candidate && this.peer) {
      if (!data.targetPeerId || data.targetPeerId === this.peerId) {
        try {
          await this.peer.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn('ICE candidate error:', e);
        }
      }
    } else if (data.type === 'peer_hangup') {
      if (!data.targetPeerId || data.targetPeerId === this.peerId) {
        this.closePeer();
        this.setState('disconnected');
      }
    }
  }

  // Mute local microphone track
  setMuted(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  // Hangup call
  hangup() {
    if (this.channel) {
      this.channel.postMessage({
        type: 'peer_hangup',
        fromPeerId: this.peerId,
      } as PeerSignalMessage);
    }
    this.closePeer();
    this.setState('idle');
  }

  closePeer() {
    if (this.peer) {
      this.peer.close();
      this.peer = null;
    }
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
    }
    this.remoteStream = null;
  }
}

export const webrtcService = new WebRtcService();
