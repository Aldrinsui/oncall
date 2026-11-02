// WebRTC Peer-to-Peer Service for multi-tab human-to-human calling
// Uses BroadcastChannel for local zero-server signaling + RTCPeerConnection for real audio streams.

export class WebRtcService {
  private peer: RTCPeerConnection | null = null;
  private channel: BroadcastChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onPeerMessageCallback: ((data: any) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('onground-callcentre-peer');
      this.channel.onmessage = (event) => {
        this.handleSignalMessage(event.data);
      };
    }
  }

  setCallbacks(
    onRemoteStream: (stream: MediaStream) => void,
    onPeerMessage: (data: any) => void
  ) {
    this.onRemoteStreamCallback = onRemoteStream;
    this.onPeerMessageCallback = onPeerMessage;
  }

  // Initialize peer connection with standard STUN server
  private createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && this.channel) {
        this.channel.postMessage({ type: 'candidate', candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(event.streams[0]);
        }
      }
    };

    return pc;
  }

  // Start outbound WebRTC call
  async startPeerCall(stream: MediaStream) {
    this.localStream = stream;
    this.peer = this.createPeerConnection();

    this.localStream.getTracks().forEach((track) => {
      this.peer?.addTrack(track, this.localStream!);
    });

    const offer = await this.peer.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await this.peer.setLocalDescription(offer);

    if (this.channel) {
      this.channel.postMessage({ type: 'offer', sdp: offer });
    }
  }

  // Accept inbound WebRTC call
  async acceptPeerCall(stream: MediaStream, remoteOffer: RTCSessionDescriptionInit) {
    this.localStream = stream;
    this.peer = this.createPeerConnection();

    this.localStream.getTracks().forEach((track) => {
      this.peer?.addTrack(track, this.localStream!);
    });

    await this.peer.setRemoteDescription(new RTCSessionDescription(remoteOffer));
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);

    if (this.channel) {
      this.channel.postMessage({ type: 'answer', sdp: answer });
    }
  }

  private async handleSignalMessage(data: any) {
    if (!data) return;

    if (this.onPeerMessageCallback) {
      this.onPeerMessageCallback(data);
    }

    if (data.type === 'offer' && this.onPeerMessageCallback) {
      // Incoming peer call notification
    } else if (data.type === 'answer' && this.peer) {
      await this.peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } else if (data.type === 'candidate' && this.peer) {
      try {
        await this.peer.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.warn('ICE candidate error:', e);
      }
    } else if (data.type === 'hangup') {
      this.closeCall();
    }
  }

  sendHangup() {
    if (this.channel) {
      this.channel.postMessage({ type: 'hangup' });
    }
    this.closeCall();
  }

  closeCall() {
    if (this.peer) {
      this.peer.close();
      this.peer = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.remoteStream = null;
  }
}

export const webrtcService = new WebRtcService();
