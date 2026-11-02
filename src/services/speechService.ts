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
  private lastSynthesizedText = '';
  private ttsCooldownTimer: ReturnType<typeof setTimeout> | null = null;

  getIsSpeakingAloud(): boolean {
    return this.isSpeakingAloud;
  }

  // 1. Speak aloud customer dialogue using SpeechSynthesis
  speak(text: string, onEnd?: () => void) {
    if (!this.synth) {
      if (onEnd) setTimeout(onEnd, 1000);
      return;
    }

    if (this.ttsCooldownTimer) {
      clearTimeout(this.ttsCooldownTimer);
      this.ttsCooldownTimer = null;
    }

    // Retain customer synthesized text to filter any acoustic echo leaks
    this.lastSynthesizedText = text.toLowerCase().trim();
    this.isSpeakingAloud = true;

    // CRITICAL P0: Abort speech recognition immediately so incoming laptop speaker audio is not captured into STT buffer
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort(); // Immediately halts audio capture and purges buffers in-flight
      } catch (err) {
        // Recognition may already be stopped
      }
      this.isListening = false;
      if (this.onStatusCallback) this.onStatusCallback('idle');
    }

    this.synth.cancel(); // Stop any pending utterances

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
      // 500ms room acoustic decay cooldown before re-enabling agent mic transcription
      this.ttsCooldownTimer = setTimeout(() => {
        this.isSpeakingAloud = false;
        // Resume STT only after TTS playback finishes and acoustic cooldown elapses
        if (this.shouldBeListening && !this.isListening && this.recognition) {
          try {
            this.recognition.start();
            this.isListening = true;
            if (this.onStatusCallback) this.onStatusCallback('listening');
          } catch (err) {
            this.isListening = false;
          }
        }
      }, 500);

      if (onEnd) onEnd();
    };

    utterance.onend = handleEnd;
    utterance.onerror = handleEnd;

    this.synth.speak(utterance);
  }

  stopSpeaking() {
    if (this.ttsCooldownTimer) {
      clearTimeout(this.ttsCooldownTimer);
      this.ttsCooldownTimer = null;
    }
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

  // Algorithmic echo filter: suppresses audio that matches recent customer speech synthesis
  private isEchoOfCustomerUtterance(agentText: string): boolean {
    if (!this.lastSynthesizedText) return false;
    const cleanAgent = agentText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const cleanCustomer = this.lastSynthesizedText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (!cleanAgent || !cleanCustomer) return false;

    // Substring containment in customer speech
    if (cleanCustomer.includes(cleanAgent)) {
      console.warn('SpeechRecognition: Suppressed customer speech echo (substring):', agentText);
      return true;
    }

    // Word token overlap check
    const agentWords = cleanAgent.split(/\s+/).filter((w) => w.length > 2);
    if (agentWords.length >= 3) {
      const customerWords = new Set(cleanCustomer.split(/\s+/));
      const matchCount = agentWords.filter((w) => customerWords.has(w)).length;
      if (matchCount / agentWords.length >= 0.5) {
        console.warn('SpeechRecognition: Suppressed customer speech echo (token overlap):', agentText);
        return true;
      }
    }
    return false;
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

  private shouldBeListening = false;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onStatusCallback: ((status: 'listening' | 'idle' | 'error') => void) | null = null;
  private onResultCallback: ((text: string) => void) | null = null;

  isSpeechRecognitionSupported(): boolean {
    return !!this.recognition;
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  // 3. Start live speech recognition for agent voice with validation & confidence filter
  startSpeechRecognition(
    onResult: (text: string) => void,
    onError?: (error: string) => void,
    onStatusChange?: (status: 'listening' | 'idle' | 'error') => void
  ) {
    if (!this.recognition) {
      if (onError) onError('Web Speech API is not supported in this browser. Please use Google Chrome.');
      return;
    }

    this.onResultCallback = onResult;
    this.onErrorCallback = onError || null;
    this.onStatusCallback = onStatusChange || null;
    this.shouldBeListening = true;

    if (this.isListening) return;

    try {
      this.isListening = true;
      if (this.onStatusCallback) this.onStatusCallback('listening');

      this.recognition.onresult = (event: any) => {
        // Prevent microphone from transcribing the customer's synthesized voice or acoustic room decay
        if (this.isSpeakingAloud || Date.now() - this.lastSpeakingEndTime < 600) {
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
          // Suppress TTS acoustic echo leak
          if (this.isEchoOfCustomerUtterance(cleaned)) {
            return;
          }

          // Deduplicate identical utterances fired within 2.5 seconds
          if (cleaned === this.lastProcessedText && now - this.lastProcessedTime < 2500) {
            return;
          }
          this.lastProcessedText = cleaned;
          this.lastProcessedTime = now;
          if (this.onResultCallback) this.onResultCallback(cleaned);
        }
      };

      this.recognition.onerror = (e: any) => {
        console.warn('SpeechRecognition error:', e.error, e);
        this.isListening = false;
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          this.shouldBeListening = false;
          if (this.onErrorCallback) {
            this.onErrorCallback('Microphone permission denied for speech recognition.');
          }
        } else if (e.error === 'no-speech') {
          // Normal pause in speech, don't disarm session
        } else if (e.error === 'audio-capture') {
          if (this.onErrorCallback) {
            this.onErrorCallback('No microphone hardware detected.');
          }
        } else if (e.error === 'network') {
          if (this.onErrorCallback) {
            this.onErrorCallback('Speech recognition network error. Reconnecting...');
          }
        }
        if (this.onStatusCallback) this.onStatusCallback('error');
      };

      this.recognition.onend = () => {
        this.isListening = false;
        // Auto-restart only if call is still active, recognition was not intentionally stopped, and TTS is NOT currently speaking
        if (this.shouldBeListening && !this.isSpeakingAloud) {
          setTimeout(() => {
            if (this.shouldBeListening && !this.isSpeakingAloud && !this.isListening && this.recognition) {
              try {
                this.recognition.start();
                this.isListening = true;
                if (this.onStatusCallback) this.onStatusCallback('listening');
              } catch (err) {
                this.isListening = false;
              }
            }
          }, 300);
        } else {
          if (this.onStatusCallback) this.onStatusCallback('idle');
        }
      };

      this.recognition.start();
    } catch (e) {
      this.isListening = false;
      console.warn('Failed to start SpeechRecognition:', e);
      if (this.onErrorCallback) {
        this.onErrorCallback('Unable to initialize browser speech recognition engine.');
      }
      if (this.onStatusCallback) this.onStatusCallback('error');
    }
  }

  stopSpeechRecognition() {
    this.shouldBeListening = false;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onStatusCallback = null;

    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.isListening = false;
    }
  }

}

export const speechService = new SpeechService();
