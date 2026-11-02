import { useState, useEffect, useRef, useTransition } from 'react';
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
  Radio,
  CheckCircle2,
  Sparkles,
  PhoneCall,
  UserCheck,
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
    addRecentCall,
  } = useApp();

  // Call timer & media controls state
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isMicActive, setIsMicActive] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // WebRTC multi-tab peer state
  const [peerConnected, setPeerConnected] = useState(false);
  const [incomingPeerOffer, setIncomingPeerOffer] = useState<{ sdp: any; caller: any } | null>(null);

  // Dynamic Sentiment score & label
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

  // Mutable refs to prevent stale closures in async speech callbacks
  const secondsRef = useRef(0);
  const sopChecksRef = useRef(sopChecks);
  const isMutedRef = useRef(false);
  const isOnHoldRef = useRef(false);
  const isSpeakerOnRef = useRef(true);
  const customerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptLinesRef = useRef<TranscriptLine[]>([]);

  useEffect(() => {
    sopChecksRef.current = sopChecks;
  }, [sopChecks]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isOnHoldRef.current = isOnHold;
  }, [isOnHold]);

  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn;
  }, [isSpeakerOn]);

  useEffect(() => {
    transcriptLinesRef.current = transcriptLines;
  }, [transcriptLines]);

  // 1. Audio Ringing Tone Handling
  useEffect(() => {
    if (callState === 'ringing') {
      audioService.startRinging();
      setSeconds(0);
      secondsRef.current = 0;
      setTranscriptLines([]);
      transcriptLinesRef.current = [];
      const initialSop = {
        opening: false,
        discovery: false,
        pitch: false,
        emi: false,
        warranty: false,
        closing: false,
      };
      setSopChecks(initialSop);
      sopChecksRef.current = initialSop;
      setSentiment('Positive');
      setSentimentScore(88);
    } else {
      audioService.stopRinging();
    }

    return () => {
      audioService.stopRinging();
    };
  }, [callState]);

  // 2. WebRTC Peer Signaling Callback Registration
  useEffect(() => {
    webrtcService.setCallbacks(
      (remoteStream) => {
        setPeerConnected(true);
        showToast('WebRTC Peer Audio Connected! Two-way audio live across browser tabs.');
      },
      (data) => {
        if (data.type === 'offer') {
          setIncomingPeerOffer({ sdp: data.sdp, caller: data.caller });
        } else if (data.type === 'answer') {
          setPeerConnected(true);
          showToast('Peer accepted WebRTC call!');
        } else if (data.type === 'hangup') {
          setPeerConnected(false);
          setIncomingPeerOffer(null);
          showToast('Remote peer disconnected');
        }
      }
    );

    return () => {
      // Clear callbacks on unmount
      webrtcService.setCallbacks(() => {}, () => {});
    };
  }, []);

  // 3. Active Call Timer & Speech Setup
  useEffect(() => {
    let timer: number | null = null;
    if (callState === 'active') {
      audioService.playConnectChime();

      // Start call timer (ticks only when not on hold)
      timer = window.setInterval(() => {
        if (!isOnHoldRef.current) {
          secondsRef.current += 1;
          setSeconds(secondsRef.current);
        }
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
        activeCallTarget?.intent.toLowerCase().includes('billing')
          ? "Hello, this is Priya. I've called twice about an unexpected charge on my EMI statement."
          : `Hello! I called earlier regarding the ${activeCallTarget?.product || 'mattress'} I saw in your Koramangala store.`;

      const customerLine: TranscriptLine = {
        id: 'line-1',
        speaker: 'customer',
        name: activeCallTarget?.name || 'Customer',
        text: openingGreeting,
        time: '0:01',
      };
      setTranscriptLines([customerLine]);
      transcriptLinesRef.current = [customerLine];

      if (isSpeakerOnRef.current && !isOnHoldRef.current) {
        speechService.speak(openingGreeting);
      }

      // Listen for agent microphone speech
      speechService.startSpeechRecognition((text) => {
        handleAgentSpeech(text);
      });
    }

    return () => {
      if (timer) clearInterval(timer);
      if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);
      speechService.stopMicrophone();
      speechService.stopSpeechRecognition();
      speechService.stopSpeaking();
    };
  }, [callState]);

  // Handle agent speaking (either via microphone STT or quick prompt)
  const handleAgentSpeech = (text: string) => {
    // If agent is muted or on hold, suppress processing
    if (isMutedRef.current || isOnHoldRef.current) return;

    const currentSecs = secondsRef.current;
    const timeStr = `${Math.floor(currentSecs / 60)}:${(currentSecs % 60).toString().padStart(2, '0')}`;
    const agentLine: TranscriptLine = {
      id: `line-${Date.now()}`,
      speaker: 'agent',
      name: 'Arvind Rajan (You)',
      text,
      time: timeStr,
    };

    setTranscriptLines((prev) => {
      const next = [...prev, agentLine];
      transcriptLinesRef.current = next;
      return next;
    });

    // Update SOP checklist based on spoken content
    const lower = text.toLowerCase();
    const updatedChecks = { ...sopChecksRef.current };

    if (lower.includes('hello') || lower.includes('arvind') || lower.includes('sleep company') || lower.includes('calling from')) {
      updatedChecks.opening = true;
    }
    if (lower.includes('firmness') || lower.includes('back') || lower.includes('help') || lower.includes('need') || lower.includes('looking for')) {
      updatedChecks.discovery = true;
    }
    if (lower.includes('smartgrid') || lower.includes('ortho') || lower.includes('mattress') || lower.includes('ergonomic') || lower.includes('patent')) {
      updatedChecks.pitch = true;
    }
    if (lower.includes('emi') || lower.includes('zero') || lower.includes('month') || lower.includes('interest') || lower.includes('finance')) {
      updatedChecks.emi = true;
    }
    if (lower.includes('warranty') || lower.includes('10-year') || lower.includes('trial') || lower.includes('nights') || lower.includes('sagging')) {
      updatedChecks.warranty = true;
    }
    if (lower.includes('demo') || lower.includes('whatsapp') || lower.includes('quote') || lower.includes('visit') || lower.includes('order')) {
      updatedChecks.closing = true;
    }
    setSopChecks(updatedChecks);
    sopChecksRef.current = updatedChecks;

    // Dynamic Sentiment Calculation based on conversational keywords
    let delta = 0;
    if (lower.includes('great') || lower.includes('perfect') || lower.includes('warranty') || lower.includes('zero interest')) delta += 4;
    if (lower.includes('issue') || lower.includes('charge') || lower.includes('delay') || lower.includes('problem')) delta -= 5;
    
    setSentimentScore((prev) => {
      const newScore = Math.min(98, Math.max(50, prev + delta));
      if (newScore >= 80) setSentiment('Positive');
      else if (newScore >= 65) setSentiment('Neutral');
      else setSentiment('Skeptical');
      return newScore;
    });

    // AI Customer responds dynamically after short natural pause
    if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);
    customerTimeoutRef.current = setTimeout(() => {
      if (isOnHoldRef.current) return;

      let customerReply = "That makes sense. Could you break down the zero-interest EMI financing terms?";
      if (lower.includes('emi') || lower.includes('finance')) {
        customerReply = "Great! And what about the warranty? Does it cover sagging over time?";
        setSentiment('Positive');
        setSentimentScore((prev) => Math.min(98, prev + 3));
      } else if (lower.includes('warranty') || lower.includes('sagging')) {
        customerReply = "10 years warranty is fantastic! Can you send me the quote and store address on WhatsApp?";
        setSentiment('Positive');
        setSentimentScore((prev) => Math.min(98, prev + 4));
      } else if (lower.includes('whatsapp') || lower.includes('demo') || lower.includes('visit')) {
        customerReply = "Perfect! I'll visit your Koramangala store this weekend to test the mattress.";
        setSentiment('Positive');
        setSentimentScore((prev) => Math.min(98, prev + 3));
      } else if (lower.includes('firmness') || lower.includes('back')) {
        customerReply = "I have mild lower back soreness after work, so I need something with firm orthopedic alignment.";
      }

      const replySecs = secondsRef.current;
      const replyLine: TranscriptLine = {
        id: `line-${Date.now() + 1}`,
        speaker: 'customer',
        name: activeCallTarget?.name || 'Customer',
        text: customerReply,
        time: `${Math.floor(replySecs / 60)}:${(replySecs % 60).toString().padStart(2, '0')}`,
      };

      setTranscriptLines((prev) => {
        const next = [...prev, replyLine];
        transcriptLinesRef.current = next;
        return next;
      });

      if (isSpeakerOnRef.current && !isOnHoldRef.current) {
        speechService.speak(customerReply);
      }
    }, 1200);
  };

  // Toggle Hardware Microphone Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;
    speechService.setMuted(nextMuted);
    showToast(nextMuted ? 'Microphone muted (hardware audio stopped)' : 'Microphone unmuted (live)');
  };

  // Toggle Call Hold
  const handleToggleHold = () => {
    const nextHold = !isOnHold;
    setIsOnHold(nextHold);
    isOnHoldRef.current = nextHold;
    speechService.setMuted(nextHold || isMutedRef.current);

    if (nextHold) {
      speechService.stopSpeaking();
      if (customerTimeoutRef.current) {
        clearTimeout(customerTimeoutRef.current);
        customerTimeoutRef.current = null;
      }
      showToast('Call on hold — microphone & customer speech paused');
    } else {
      showToast('Call resumed');
    }
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
        showToast('Microphone live — speak to converse with customer');
      } else {
        showToast('Microphone permission required. Use quick prompts below.');
      }
    }
  };

  // Start WebRTC Peer Calling between two tabs
  const handleStartWebRtcPeerCall = async () => {
    const stream = speechService.getStream();
    if (!stream) {
      const node = await speechService.startMicrophone();
      if (!node) {
        showToast('Microphone access needed for WebRTC calling');
        return;
      }
    }
    const liveStream = speechService.getStream();
    if (liveStream) {
      await webrtcService.startPeerCall(liveStream, {
        name: activeCallTarget?.name || 'Customer',
        phone: activeCallTarget?.phone || '+91 98450 12345',
      });
      showToast('WebRTC Outbound Call initiated. Answer in your 2nd tab!');
    }
  };

  // Accept incoming WebRTC Peer Call from 2nd tab
  const handleAcceptIncomingPeerCall = async () => {
    if (!incomingPeerOffer) return;
    const node = await speechService.startMicrophone();
    const liveStream = speechService.getStream();
    if (liveStream) {
      await webrtcService.acceptPeerCall(liveStream, incomingPeerOffer.sdp);
      setPeerConnected(true);
      setIncomingPeerOffer(null);
      setCallState('active');
      showToast('WebRTC Peer Connection Connected! Speak into microphone.');
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
    speechService.stopSpeechRecognition();
    speechService.stopSpeaking();
    webrtcService.sendHangup();
    if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);
    setCallState('wrapup');
    setWrapupOpen(true);
  };

  // Helper to extract actual quote from agent transcript lines for SOP evidence
  const findEvidenceQuote = (keywords: string[], fallback: string) => {
    const match = transcriptLinesRef.current.find(
      (line) => line.speaker === 'agent' && keywords.some((kw) => line.text.toLowerCase().includes(kw))
    );
    return match ? `"${match.text}"` : fallback;
  };

  const handleSaveWrapup = (outcomeKey: string, notes: string) => {
    setWrapupOpen(false);

    // Map all 5 outcomes correctly to label and color
    let outcomeLabel: RecentCall['outcome'] = 'Follow-up';
    let outcomeColor = '#c8860a';

    switch (outcomeKey) {
      case 'interested':
        outcomeLabel = 'Interested';
        outcomeColor = '#0f6e56';
        break;
      case 'resolved':
        outcomeLabel = 'Resolved';
        outcomeColor = '#1d9e75';
        break;
      case 'callback':
        outcomeLabel = 'Requested callback';
        outcomeColor = '#185fa5';
        break;
      case 'notinterested':
        outcomeLabel = 'Not interested';
        outcomeColor = '#e24b4a';
        break;
      case 'followup':
      default:
        outcomeLabel = 'Follow-up';
        outcomeColor = '#c8860a';
        break;
    }

    // Dynamic SOP Score based on checklist achievements
    const passedCount = Object.values(sopChecksRef.current).filter(Boolean).length;
    const finalScore = Math.min(98, Math.max(68, passedCount * 16));

    // Dynamic transcript evidence extraction
    const currentChecks = sopChecksRef.current;
    const callReview: RecentCall = {
      id: `rc-${Date.now()}`,
      name: activeCallTarget?.name || 'Customer',
      initials: activeCallTarget?.initials || 'CU',
      direction: 'outbound',
      duration: `${Math.floor(secondsRef.current / 60)}m ${(secondsRef.current % 60).toString().padStart(2, '0')}s`,
      time: 'Just now',
      outcome: outcomeLabel,
      outcomeColor,
      value: activeCallTarget?.value || '₹8,490',
      sopScore: finalScore,
      reviewItems: [
        {
          criterion: 'Opening & Intent Confirm',
          passed: currentChecks.opening,
          score: currentChecks.opening ? 96 : 70,
          evidence: findEvidenceQuote(['hello', 'arvind', 'sleep company'], 'Opening greeting was omitted or unclear'),
        },
        {
          criterion: 'Needs & Firmness Discovery',
          passed: currentChecks.discovery,
          score: currentChecks.discovery ? 92 : 65,
          evidence: findEvidenceQuote(['firmness', 'back', 'pain', 'need'], 'Customer firmness & posture requirements not probed'),
        },
        {
          criterion: 'Product Pitch',
          passed: currentChecks.pitch,
          score: currentChecks.pitch ? 94 : 70,
          evidence: findEvidenceQuote(['smartgrid', 'ortho', 'mattress'], 'SmartGRID patented technology not highlighted'),
        },
        {
          criterion: 'EMI / Financing Mention',
          passed: currentChecks.emi,
          score: currentChecks.emi ? 95 : 60,
          evidence: findEvidenceQuote(['emi', 'zero', 'month', 'interest'], 'Zero-interest finance terms not presented'),
        },
        {
          criterion: 'Warranty Mention',
          passed: currentChecks.warranty,
          score: currentChecks.warranty ? 96 : 65,
          evidence: findEvidenceQuote(['warranty', '10-year', 'trial'], '10-year warranty guarantee was not stated'),
        },
        {
          criterion: 'Closing / Showroom Visit Booking',
          passed: currentChecks.closing,
          score: currentChecks.closing ? 94 : 70,
          evidence: findEvidenceQuote(['whatsapp', 'visit', 'store', 'demo'], 'WhatsApp quote or Koramangala store visit not booked'),
        },
      ],
    };

    // Store notes in call record
    (callReview as any).notes = notes.trim() || 'No additional notes entered.';

    // Append newly completed call to AppContext state so Recent Calls tab updates immediately
    addRecentCall(callReview);

    setCompletedCallReview(callReview);
    setReviewOpen(true);
    setCallState('idle');
  };

  const handleCloseWrapup = () => {
    setWrapupOpen(false);
    setCallState('idle');
    audioService.stopRinging();
    speechService.stopMicrophone();
    speechService.stopSpeaking();
  };

  if (callState === 'idle') {
    // Show incoming WebRTC peer offer banner if another browser tab is calling
    if (incomingPeerOffer) {
      return (
        <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-emerald-800 to-og-forest text-white shadow-lg flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <Radio size={20} className="text-og-green-light animate-pulse" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-200">
                Incoming WebRTC Peer Audio Call
              </div>
              <div className="text-sm font-black">
                {incomingPeerOffer.caller?.name || 'Agent (Second Tab)'} ({incomingPeerOffer.caller?.phone || 'WebRTC Intercom'})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIncomingPeerOffer(null)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
            >
              Ignore
            </button>
            <button
              onClick={handleAcceptIncomingPeerCall}
              className="px-4 py-1.5 rounded-lg bg-og-green hover:bg-emerald-600 text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <PhoneCall size={14} />
              <span>Accept Peer Audio</span>
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

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
                  {peerConnected && (
                    <span className="text-[10px] bg-teal-400 text-slate-900 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                      <Radio size={10} />
                      Peer WebRTC Live
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-emerald-200 mt-0.5">
                  <span className="font-mono text-base font-bold text-white tracking-wider">
                    {formatTimer(seconds)}
                  </span>
                  {isOnHold && (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900 px-2 py-0.5 rounded">
                      ON HOLD
                    </span>
                  )}
                  <span>•</span>
                  <span>Sentiment:</span>
                  <span className="text-xs font-bold text-og-green-light bg-black/30 px-2 py-0.5 rounded-full">
                    {sentiment} ({sentimentScore}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Calling Engine Actions & WebRTC Intercom */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={handleStartWebRtcPeerCall}
                className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-white/10 transition-colors"
                title="Connect two browser tabs via real WebRTC peer audio"
              >
                <Radio size={12} className={peerConnected ? 'text-teal-300' : 'text-og-green-light'} />
                <span>{peerConnected ? 'Peer Audio Active' : 'Start WebRTC Peer Call'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(window.location.href, '_blank');
                  showToast('Opened 2nd tab. Click "Start WebRTC Peer Call" to connect audio between tabs!');
                }}
                className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-white/10 transition-colors"
                title="Open a second browser tab for human-to-human WebRTC audio calling"
              >
                <UserCheck size={12} className="text-amber-300" />
                <span>Open 2nd Tab</span>
              </button>
            </div>

            {/* Audio Waveform + Hardware In-Call Controls */}
            <div className="flex items-center gap-3 self-center sm:self-auto flex-wrap">
              <AudioVisualizer analyser={analyser} isActive={!isOnHold && !isMuted} />

              {/* Hardware Mute Button */}
              <button
                type="button"
                onClick={handleToggleMute}
                className={`p-2.5 rounded-xl border transition-colors ${
                  isMuted ? 'bg-red-500/20 border-red-400 text-red-200' : 'bg-white/10 border-white/10 hover:bg-white/20 text-white'
                }`}
                title={isMuted ? 'Unmute microphone (live audio)' : 'Mute microphone (stops track)'}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {/* Hold Button */}
              <button
                type="button"
                onClick={handleToggleHold}
                className={`p-2.5 rounded-xl border transition-colors ${
                  isOnHold ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-white/10 border-white/10 hover:bg-white/20 text-white'
                }`}
                title={isOnHold ? 'Resume call from hold' : 'Put call on hold'}
                aria-label={isOnHold ? 'Resume call' : 'Put on hold'}
              >
                {isOnHold ? <Play size={16} /> : <Pause size={16} />}
              </button>

              {/* Speaker Toggle */}
              <button
                type="button"
                onClick={() => {
                  const nextSpeaker = !isSpeakerOn;
                  setIsSpeakerOn(nextSpeaker);
                  if (!nextSpeaker) speechService.stopSpeaking();
                }}
                className="p-2.5 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 text-white transition-colors"
                title={isSpeakerOn ? 'Mute customer voice speaker' : 'Enable customer speaker'}
                aria-label={isSpeakerOn ? 'Mute speaker' : 'Enable speaker'}
              >
                {isSpeakerOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* End Call Button */}
              <button
                type="button"
                onClick={handleHangup}
                className="px-4 py-2.5 bg-og-red hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
                aria-label="End active call"
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
          onClose={handleCloseWrapup}
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
