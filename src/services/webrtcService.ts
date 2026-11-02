// WebRTC Peer-to-Peer Service for multi-tab human-to-human calling
// Uses BroadcastChannel for local zero-server signaling + RTCPeerConnection for real audio streams.

export class WebRtcService {
  private peer: RTCPeerConnection | null = null;
  private channel: BroadcastChannel | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private pendingOffer: RTCSessionDescriptionInit | null = null;
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

  getPendingOffer(): RTCSessionDescriptionInit | null {
    return this.pendingOffer;
  }

  // Initialize peer connection with standard Google STUN server
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
        // Automatically play remote audio in the browser speaker
        if (typeof Audio !== 'undefined') {
          try {
            if (!this.audioElement) {
              this.audioElement = new Audio();
              this.audioElement.autoplay = true;
            }
            this.audioElement.srcObject = event.streams[0];
            this.audioElement.play().catch((err) => console.warn('Peer audio autoplay:', err));
          } catch (e) {
            console.warn('Could not attach remote audio stream:', e);
          }
        }
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(event.streams[0]);
        }
      }
    };

    return pc;
  }

  // Start outbound WebRTC call
  async startPeerCall(stream: MediaStream, callerMeta?: any) {
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
      this.channel.postMessage({
        type: 'offer',
        sdp: offer,
        caller: callerMeta || { name: 'Agent (Peer Tab)', phone: 'WebRTC Intercom' },
      });
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

    if (data.type === 'offer') {
      this.pendingOffer = data.sdp;
      if (this.onPeerMessageCallback) {
        this.onPeerMessageCallback(data);
      }
    } else if (data.type === 'answer' && this.peer) {
      await this.peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      if (this.onPeerMessageCallback) {
        this.onPeerMessageCallback(data);
      }
    } else if (data.type === 'candidate' && this.peer) {
      try {
        await this.peer.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (e) {
        console.warn('ICE candidate error:', e);
      }
    } else if (data.type === 'hangup') {
      this.closeCall();
      if (this.onPeerMessageCallback) {
        this.onPeerMessageCallback(data);
      }
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
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.srcObject = null;
    }
    this.pendingOffer = null;
    this.remoteStream = null;
  }
}

export const webrtcService = new WebRtcService();
