// Web Audio API Synthesizer for telephone tones, DTMF key tones, and call audio feedback
// Zero external assets required — 100% reliable across modern browsers.

class AudioService {
  private ctx: AudioContext | null = null;
  private ringOsc1: OscillatorNode | null = null;
  private ringOsc2: OscillatorNode | null = null;
  private ringGain: GainNode | null = null;
  private ringInterval: number | null = null;
  private isRinging: boolean = false;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Check if ringtone is actively running
  getIsRinging(): boolean {
    return this.isRinging;
  }

  // Start telephone ringing tone (standard dual-frequency ring: 440Hz + 480Hz)
  startRinging() {
    if (this.isRinging) {
      return; // Already actively ringing continuously, preserve ring cadence
    }
    this.isRinging = true;

    try {
      const ctx = this.getContext();

      const playBurst = () => {
        if (!this.isRinging) return;

        // Clean up previous burst nodes safely before starting next burst
        this.stopActiveBurstNodes();

        try {
          const now = ctx.currentTime;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(440, now);
          osc2.frequency.setValueAtTime(480, now);

          // Ring cadence: 1.5s ring, gentle fade out
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
          gain.gain.setValueAtTime(0.15, now + 1.5);
          gain.gain.linearRampToValueAtTime(0, now + 1.6);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          this.ringOsc1 = osc1;
          this.ringOsc2 = osc2;
          this.ringGain = gain;

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.7);
          osc2.stop(now + 1.7);

          osc1.onended = () => {
            if (this.ringOsc1 === osc1) this.ringOsc1 = null;
          };
          osc2.onended = () => {
            if (this.ringOsc2 === osc2) this.ringOsc2 = null;
          };
        } catch (e) {
          console.warn('Audio ring burst error:', e);
        }
      };

      playBurst();
      const setInt = typeof window !== 'undefined' && window.setInterval ? window.setInterval.bind(window) : setInterval;
      this.ringInterval = setInt(playBurst, 3500) as unknown as number;
    } catch (e) {
      console.warn('Audio ring could not start automatically:', e);
    }
  }

  private stopActiveBurstNodes() {
    // Immediately ramp the active gain to zero to silence any in-flight sound
    if (this.ringGain) {
      try {
        if (this.ctx) {
          const now = this.ctx.currentTime;
          this.ringGain.gain.cancelScheduledValues(now);
          this.ringGain.gain.setValueAtTime(0, now);
        }
        this.ringGain.disconnect();
      } catch (e) {
        // Safe cleanup
      }
      this.ringGain = null;
    }

    // Safely stop and disconnect osc1
    if (this.ringOsc1) {
      try {
        this.ringOsc1.onended = null;
        this.ringOsc1.stop();
        this.ringOsc1.disconnect();
      } catch (e) {
        // Safe cleanup if already stopped
      }
      this.ringOsc1 = null;
    }

    // Safely stop and disconnect osc2
    if (this.ringOsc2) {
      try {
        this.ringOsc2.onended = null;
        this.ringOsc2.stop();
        this.ringOsc2.disconnect();
      } catch (e) {
        // Safe cleanup if already stopped
      }
      this.ringOsc2 = null;
    }
  }

  stopRinging() {
    this.isRinging = false;

    if (this.ringInterval !== null) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }

    this.stopActiveBurstNodes();
  }

  // Play pleasant call connected chime
  playConnectChime() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2); // A5

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {
      // Audio playback fallback
    }
  }

  // Play call hangup tone
  playDisconnectTone() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(350, now + 0.15);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      // Audio fallback
    }
  }

  // Play realistic DTMF telephone key tones
  playDtmfTone(key: string) {
    try {
      const dtmfFrequencies: Record<string, [number, number]> = {
        '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
        '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
        '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
        '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
      };

      const freqs = dtmfFrequencies[key] || [770, 1336];
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(freqs[0], now);
      osc2.frequency.setValueAtTime(freqs[1], now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.2);
      osc2.stop(now + 0.2);
    } catch (e) {
      // Audio fallback
    }
  }
}

export const audioService = new AudioService();
