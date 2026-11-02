// Web Speech API for AI Customer Voice (SpeechSynthesis) and Microphone Speech Recognition (STT)

export class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private recognition: any = null;
  private micStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isListening = false;

  constructor() {
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
      }

      // Initialize Web Speech Recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          this.recognition = new SpeechRecognition();
          this.recognition.continuous = true;
          this.recognition.interimResults = true;
          this.recognition.lang = 'en-IN';
        } catch (e) {
          console.warn('SpeechRecognition initialization error:', e);
        }
      }
    }
  }

  private isSpeakingAloud = false;
  private lastSpeakingEndTime = 0;
  private lastProcessedText = '';
  private lastProcessedTime = 0;

  getIsSpeakingAloud(): boolean {
    return this.isSpeakingAloud;
  }

  // 1. Speak aloud customer dialogue using SpeechSynthesis
  speak(text: string, onEnd?: () => void) {
    if (!this.synth) {
      if (onEnd) setTimeout(onEnd, 1000);
      return;
    }

    this.synth.cancel(); // Stop any pending utterances
    this.isSpeakingAloud = true;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to pick an English voice (Indian English or standard natural voice if available)
    const voices = this.synth.getVoices();
    const naturalVoice =
      voices.find((v) => v.lang.includes('en-IN')) ||
      voices.find((v) => v.lang.includes('en-GB')) ||
      voices.find((v) => v.lang.includes('en-US')) ||
      voices[0];

    if (naturalVoice) {
      utterance.voice = naturalVoice;
    }

    const handleEnd = () => {
      this.lastSpeakingEndTime = Date.now();
      // 400ms room acoustic decay delay before re-enabling agent mic transcription
      setTimeout(() => {
        this.isSpeakingAloud = false;
      }, 400);
      if (onEnd) onEnd();
    };

    utterance.onend = handleEnd;
    utterance.onerror = handleEnd;

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.lastSpeakingEndTime = Date.now();
    this.isSpeakingAloud = false;
  }

  // 2. Start microphone capture with Web Audio Analyser for live visualizer
  async startMicrophone(): Promise<AnalyserNode | null> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return null;
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx =
        window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const source = this.audioCtx.createMediaStreamSource(this.micStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      return this.analyser;
    } catch (err) {
      console.warn('Microphone permission not granted or unavailable:', err);
      return null;
    }
  }

  getStream(): MediaStream | null {
    return this.micStream;
  }

  // Real hardware microphone mute: disables/enables audio tracks on the live stream
  setMuted(muted: boolean) {
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  stopMicrophone() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  // Validate agent speech recognition results to filter noise and isolated numbers
  private isValidUtterance(rawText: string): boolean {
    const text = rawText.trim();
    if (text.length < 2) return false;

    // Filter out isolated raw numeric noise (e.g. "5674748833") with no surrounding words
    const digitsOnly = text.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 6 && text.replace(/[0-9\s\-]/g, '').length === 0) {
      console.warn('SpeechRecognition: Suppressed isolated raw numeric noise:', text);
      return false;
    }

    // Filter out single character repetitions (e.g. "aaaaa", ".....")
    if (/^(.)\1{4,}$/.test(text)) {
      return false;
    }

    return true;
  }

  // 3. Start live speech recognition for agent voice with validation & confidence filter
  startSpeechRecognition(onResult: (text: string) => void) {
    if (!this.recognition || this.isListening) return;

    try {
      this.isListening = true;
      this.recognition.onresult = (event: any) => {
        // Prevent microphone from transcribing the customer's synthesized voice or acoustic room decay
        if (this.isSpeakingAloud || Date.now() - this.lastSpeakingEndTime < 400) {
          return;
        }

        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            // Check confidence score if provided by browser
            const confidence = result[0]?.confidence;
            if (typeof confidence === 'number' && confidence > 0 && confidence < 0.45) {
              console.warn('SpeechRecognition: Low confidence utterance suppressed:', confidence, result[0].transcript);
              continue;
            }
            finalTranscript += result[0].transcript;
          }
        }

        const cleaned = finalTranscript.trim();
        const now = Date.now();

        if (cleaned && this.isValidUtterance(cleaned)) {
          // Deduplicate identical utterances fired within 2.5 seconds
          if (cleaned === this.lastProcessedText && now - this.lastProcessedTime < 2500) {
            return;
          }
          this.lastProcessedText = cleaned;
          this.lastProcessedTime = now;
          onResult(cleaned);
        }
      };

      this.recognition.onerror = (e: any) => {
        console.warn('Speech recognition error/ended:', e);
        this.isListening = false;
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      this.recognition.start();
    } catch (e) {
      this.isListening = false;
    }
  }

  stopSpeechRecognition() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }
}

export const speechService = new SpeechService();
