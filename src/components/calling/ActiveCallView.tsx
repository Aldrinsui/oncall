import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  Volume2,
  VolumeX,
  Share2,
  Sparkles,
  Award,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import LiveTranscript, { TranscriptLine } from './LiveTranscript';
import AiAssistPanel from './AiAssistPanel';
import CallWrapupModal from './CallWrapupModal';
import CallSopReviewModal from '../modals/CallSopReviewModal';
import { audioService } from '../../services/audioService';
import { speechService } from '../../services/speechService';
import { webrtcService } from '../../services/webrtcService';
import type { RecentCall, CallTarget } from '../../types';

export default function ActiveCallView() {
  const {
    callState,
    setCallState,
    activeCallTarget,
    showToast,
  } = useApp();

  // Call timer state
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isMicActive, setIsMicActive] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Sentiment score & label
  const [sentiment, setSentiment] = useState<'Positive' | 'Neutral' | 'Skeptical'>('Positive');
  const [sentimentScore, setSentimentScore] = useState(88);

  // Dynamic SOP Checklist
  const [sopChecks, setSopChecks] = useState<Record<string, boolean>>({
    opening: false,
    discovery: false,
    pitch: false,
    emi: false,
    warranty: false,
    closing: false,
  });

  // Streaming transcript lines
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([]);

  // Post-call modals
  const [wrapupOpen, setWrapupOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [completedCallReview, setCompletedCallReview] = useState<RecentCall | null>(null);

  // 1. Audio Ringing Tone Handling
  useEffect(() => {
    if (callState === 'ringing') {
      audioService.startRinging();
      setSeconds(0);
      setTranscriptLines([]);
      setSopChecks({
        opening: false,
        discovery: false,
        pitch: false,
        emi: false,
        warranty: false,
        closing: false,
      });
    } else {
      audioService.stopRinging();
    }

    return () => {
      audioService.stopRinging();
    };
  }, [callState]);

  // 2. Active Call Timer & Speech Setup
  useEffect(() => {
    let timer: number | null = null;
    if (callState === 'active') {
      audioService.playConnectChime();

      // Start call timer
      timer = window.setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);

      // Start microphone analyser for live frequency canvas
      speechService.startMicrophone().then((node) => {
        if (node) {
          setAnalyser(node);
          setIsMicActive(true);
        }
      });

      // Customer opening greeting
      const openingGreeting =
        activeCallTarget?.intent.includes('billing')
          ? "Hello, this is Priya. I've called twice about an unexpected charge on my EMI statement."
          : `Hello! I called earlier regarding the ${activeCallTarget?.product || 'mattress'} I saw in your Koramangala store.`;

      // Add to transcript and speak aloud
      const customerLine: TranscriptLine = {
        id: 'line-1',
        speaker: 'customer',
        name: activeCallTarget?.name || 'Customer',
        text: openingGreeting,
        time: 'Just now',
      };
      setTranscriptLines([customerLine]);

      if (isSpeakerOn) {
        speechService.speak(openingGreeting);
      }

      // Listen for agent microphone speech
      speechService.startSpeechRecognition((text) => {
        handleAgentSpeech(text);
      });
    }

    return () => {
      if (timer) clearInterval(timer);
      speechService.stopMicrophone();
      speechService.stopSpeechRecognition();
      speechService.stopSpeaking();
    };
  }, [callState]);

  // Handle agent speaking (either via microphone STT or quick prompt)
  const handleAgentSpeech = (text: string) => {
    const timeStr = `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    const agentLine: TranscriptLine = {
      id: `line-${Date.now()}`,
      speaker: 'agent',
      name: 'Arvind Rajan (You)',
      text,
      time: timeStr,
    };

    setTranscriptLines((prev) => [...prev, agentLine]);

    // Update SOP checklist based on spoken content
    const lower = text.toLowerCase();
    const updatedChecks = { ...sopChecks };

    if (lower.includes('hello') || lower.includes('arvind') || lower.includes('sleep company')) {
      updatedChecks.opening = true;
    }
    if (lower.includes('firmness') || lower.includes('back') || lower.includes('help') || lower.includes('need')) {
      updatedChecks.discovery = true;
    }
    if (lower.includes('smartgrid') || lower.includes('ortho') || lower.includes('mattress') || lower.includes('ergonomic')) {
      updatedChecks.pitch = true;
    }
    if (lower.includes('emi') || lower.includes('zero') || lower.includes('month') || lower.includes('interest')) {
      updatedChecks.emi = true;
    }
    if (lower.includes('warranty') || lower.includes('10-year') || lower.includes('trial') || lower.includes('nights')) {
      updatedChecks.warranty = true;
    }
    if (lower.includes('demo') || lower.includes('whatsapp') || lower.includes('quote') || lower.includes('visit')) {
      updatedChecks.closing = true;
    }
    setSopChecks(updatedChecks);

    // AI Customer responds dynamically
    setTimeout(() => {
      let customerReply = "That sounds reasonable. Can you explain how the 12-month zero-interest plan works?";
      if (lower.includes('emi')) {
        customerReply = "Great! And what about the warranty? Does it cover sagging?";
        setSentiment('Positive');
        setSentimentScore(92);
      } else if (lower.includes('warranty')) {
        customerReply = "10 years warranty is fantastic! Can you send me the quote on WhatsApp?";
        setSentiment('Positive');
        setSentimentScore(96);
      } else if (lower.includes('whatsapp') || lower.includes('demo')) {
        customerReply = "Perfect! I'll visit your Koramangala store this Saturday to try it out.";
        setSentiment('Positive');
        setSentimentScore(98);
      }

      const replyLine: TranscriptLine = {
        id: `line-${Date.now() + 1}`,
        speaker: 'customer',
        name: activeCallTarget?.name || 'Customer',
        text: customerReply,
        time: `${Math.floor((seconds + 2) / 60)}:${((seconds + 2) % 60).toString().padStart(2, '0')}`,
      };
      setTranscriptLines((prev) => [...prev, replyLine]);

      if (isSpeakerOn && !isOnHold) {
        speechService.speak(customerReply);
      }
    }, 1200);
  };

  const handleToggleMic = async () => {
    if (isMicActive) {
      speechService.stopMicrophone();
      speechService.stopSpeechRecognition();
      setIsMicActive(false);
      setAnalyser(null);
      showToast('Microphone disabled');
    } else {
      const node = await speechService.startMicrophone();
      if (node) {
        setAnalyser(node);
        setIsMicActive(true);
        speechService.startSpeechRecognition((text) => handleAgentSpeech(text));
        showToast('Microphone live — speak to converse with AI customer');
      } else {
        showToast('Microphone permission required. Use quick prompts below.');
      }
    }
  };

  const handleAnswerCall = () => {
    audioService.stopRinging();
    setCallState('active');
  };

  const handleHangup = () => {
    audioService.stopRinging();
    audioService.playDisconnectTone();
    speechService.stopMicrophone();
    speechService.stopSpeaking();
    setCallState('wrapup');
    setWrapupOpen(true);
  };

  const handleSaveWrapup = (outcomeKey: string, notes: string) => {
    setWrapupOpen(false);

    // Build completed review record from this call session
    const finalScore = Math.min(
      96,
      Math.max(72, Object.values(sopChecks).filter(Boolean).length * 16)
    );

    const callReview: RecentCall = {
      id: `rc-${Date.now()}`,
      name: activeCallTarget?.name || 'Customer',
      initials: activeCallTarget?.initials || 'CU',
      direction: 'outbound',
      duration: `${Math.floor(seconds / 60)}m ${(seconds % 60).toString().padStart(2, '0')}s`,
      time: 'Just now',
      outcome: outcomeKey === 'interested' ? 'Interested' : outcomeKey === 'resolved' ? 'Resolved' : 'Follow-up',
      outcomeColor: '#1d9e75',
      value: activeCallTarget?.value || '₹8,490',
      sopScore: finalScore,
      reviewItems: [
        { criterion: 'Opening & Intent Confirm', passed: sopChecks.opening, score: sopChecks.opening ? 96 : 70, evidence: 'Greeted customer and introduced store identity' },
        { criterion: 'Needs & Firmness Discovery', passed: sopChecks.discovery, score: sopChecks.discovery ? 92 : 65, evidence: 'Explored spine support and sleeping postures' },
        { criterion: 'Product Pitch', passed: sopChecks.pitch, score: sopChecks.pitch ? 94 : 70, evidence: 'Explained patented SmartGRID technology' },
        { criterion: 'EMI / Financing Mention', passed: sopChecks.emi, score: sopChecks.emi ? 95 : 60, evidence: 'Quoted 12-month zero-interest finance option' },
        { criterion: 'Warranty Mention', passed: sopChecks.warranty, score: sopChecks.warranty ? 96 : 65, evidence: 'Emphasized 10-year warranty with 100-night trial' },
        { criterion: 'Closing / Showroom Visit Booking', passed: sopChecks.closing, score: sopChecks.closing ? 94 : 70, evidence: 'Arranged WhatsApp quotation and showroom follow-up' },
      ],
    };

    setCompletedCallReview(callReview);
    setReviewOpen(true);
    setCallState('idle');
  };

  if (callState === 'idle') return null;

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="space-y-4 mb-6 animate-fade-in">
      {/* ─── State 1: Ringing Inbound/Outbound Call ────────────────────── */}
      {callState === 'ringing' && (
        <div className="bg-gradient-to-r from-[#7c2d12] via-[#9a3412] to-[#c2410c] text-white p-6 rounded-card shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-orange-400/30">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shadow-lg border-2 border-white/40"
                style={{
                  backgroundColor: activeCallTarget?.avatarBg || '#faeeda',
                  color: activeCallTarget?.avatarColor || '#854f0b',
                }}
              >
                {activeCallTarget?.initials || 'MK'}
              </div>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-og-gold rounded-full border-2 border-white animate-pulse" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-200">
                Calling Customer • Ringing...
              </span>
              <h3 className="text-xl font-bold">{activeCallTarget?.name || 'Mukunda R.'}</h3>
              <p className="text-xs text-orange-100 mt-0.5">
                {activeCallTarget?.phone || '+91 98450 12345'} • {activeCallTarget?.intent || 'Ortho GRID'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-center sm:self-auto">
            <button
              onClick={handleHangup}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-colors"
            >
              <PhoneOff size={16} />
              <span>Decline / Cancel</span>
            </button>
            <button
              onClick={handleAnswerCall}
              className="px-6 py-2.5 bg-og-green hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-bounce transition-all"
            >
              <Phone size={16} />
              <span>Answer / Connect</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── State 2: Active Connected Call (Side-by-Side View) ───────── */}
      {callState === 'active' && (
        <div className="space-y-4">
          {/* Active Call Header Card */}
          <div className="bg-gradient-to-r from-[#0a2e1a] via-og-forest to-[#0f6e56] text-white p-4 sm:p-5 rounded-card shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-emerald-400/20">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-md"
                style={{
                  backgroundColor: activeCallTarget?.avatarBg || '#e1f5ee',
                  color: activeCallTarget?.avatarColor || '#0f6e56',
                }}
              >
                {activeCallTarget?.initials || 'MK'}
              </div>

              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold">{activeCallTarget?.name || 'Mukunda R.'}</h3>
                  <span className="text-[11px] bg-white/15 px-2.5 py-0.5 rounded-full font-bold">
                    {activeCallTarget?.phone || '+91 98450 12345'}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-emerald-200 mt-0.5">
                  <span className="font-mono text-base font-bold text-white tracking-wider">
                    {formatTimer(seconds)}
                  </span>
                  <span>•</span>
                  <span>Sentiment:</span>
                  <span className="text-xs font-bold text-og-green-light bg-black/30 px-2 py-0.5 rounded-full">
                    {sentiment} ({sentimentScore}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Audio Waveform + In-Call Controls */}
            <div className="flex items-center gap-3 self-center sm:self-auto flex-wrap">
              <AudioVisualizer analyser={analyser} isActive={!isOnHold} />

              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  isMuted ? 'bg-red-500/20 border-red-400 text-red-200' : 'bg-white/10 border-white/10 hover:bg-white/20 text-white'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              <button
                onClick={() => setIsOnHold(!isOnHold)}
                className={`p-2.5 rounded-xl border transition-colors ${
                  isOnHold ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-white/10 border-white/10 hover:bg-white/20 text-white'
                }`}
                title={isOnHold ? 'Resume call' : 'Put on hold'}
              >
                {isOnHold ? <Play size={16} /> : <Pause size={16} />}
              </button>

              <button
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                className="p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 text-white transition-colors"
                title={isSpeakerOn ? 'Mute AI customer speaker' : 'Enable customer speaker'}
              >
                {isSpeakerOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              <button
                onClick={handleHangup}
                className="px-4 py-2.5 bg-og-red hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
              >
                <PhoneOff size={15} />
                <span>End Call</span>
              </button>
            </div>
          </div>

          {/* Side-by-Side Active Screen: Transcript (Left) + AI Assist (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <LiveTranscript
                lines={transcriptLines}
                onAgentSpeak={handleAgentSpeech}
                isMicActive={isMicActive}
                onToggleMic={handleToggleMic}
              />
            </div>

            <div>
              <AiAssistPanel
                target={activeCallTarget}
                sopChecks={sopChecks}
                onTriggerQuickReply={handleAgentSpeech}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── State 3: Call Wrapup Sheet ──────────────────────────────── */}
      {wrapupOpen && (
        <CallWrapupModal
          target={activeCallTarget}
          duration={formatTimer(seconds)}
          onSave={handleSaveWrapup}
          onClose={() => setWrapupOpen(false)}
        />
      )}

      {/* ─── State 4: Call SOP Review Modal ──────────────────────────── */}
      {reviewOpen && (
        <CallSopReviewModal
          call={completedCallReview}
          onClose={() => setReviewOpen(false)}
        />
      )}
    </div>
  );
}
