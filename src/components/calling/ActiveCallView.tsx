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
  Radio,
  CheckCircle2,
  Sparkles,
  PhoneCall,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import LiveTranscript, { TranscriptLine } from './LiveTranscript';
import AiAssistPanel from './AiAssistPanel';
import CallWrapupModal from './CallWrapupModal';
import CallSopReviewModal from '../modals/CallSopReviewModal';
import RecordingConsentModal from './RecordingConsentModal';
import { audioService } from '../../services/audioService';
import { speechService } from '../../services/speechService';
import { webrtcService, type WebRtcConnectionState } from '../../services/webrtcService';
import { ConversationStateMachine, type ConversationStage } from '../../services/conversationEngine';
import type { RecentCall, CallTarget } from '../../types';

export default function ActiveCallView() {
  const {
    callState,
    setCallState,
    activeCallTarget,
    showToast,
    addRecentCall,
    recordingConsent,
    setRecordingConsent,
    currentConsent,
    grantConsent,
    declineConsent,
    resetConsent,
    endCall,
    bridgeActiveCall,
    backendCallId,
    backendCallStatus,
    backendCallDetails,
  } = useApp();

  // DPDP Consent Modal
  const [consentModalOpen, setConsentModalOpen] = useState(false);


  // Call timer & hardware media controls state
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isMicActive, setIsMicActive] = useState(false);
  const [isSttActive, setIsSttActive] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const sttSupported = typeof window !== 'undefined' && speechService.isSpeechRecognitionSupported();


  // WebRTC multi-tab peer state
  const [peerState, setPeerState] = useState<WebRtcConnectionState>('idle');
  const [incomingPeerOffer, setIncomingPeerOffer] = useState<{
    fromPeerId: string;
    callerMeta: any;
    sdp: RTCSessionDescriptionInit;
  } | null>(null);

  // Dynamic Conversation State Machine & Sentiment
  const stateMachineRef = useRef<ConversationStateMachine | null>(null);
  const [conversationStage, setConversationStage] = useState<ConversationStage>('greeting');
  const [sentiment, setSentiment] = useState<'Positive' | 'Neutral' | 'Skeptical'>('Positive');
  const [sentimentScore, setSentimentScore] = useState(78);

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

  // Mutable refs to prevent stale closures in async speech recognition callbacks
  const secondsRef = useRef(0);
  const isMutedRef = useRef(false);
  const isOnHoldRef = useRef(false);
  const isSpeakerOnRef = useRef(true);
  const customerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptLinesRef = useRef<TranscriptLine[]>([]);

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

  // 1. Audio Ringing Tone Handling & State Reset
  useEffect(() => {
    if (callState === 'ringing') {
      audioService.startRinging();
      setSeconds(0);
      secondsRef.current = 0;
      setTranscriptLines([]);
      transcriptLinesRef.current = [];

      const sm = new ConversationStateMachine(activeCallTarget);
      stateMachineRef.current = sm;

      setConversationStage('greeting');
      setSopChecks(sm.getSopChecks());
      setSentimentScore(sm.getSentimentScore());
      setSentiment(sm.getSentimentLabel());
    } else {
      audioService.stopRinging();
    }

    return () => {
      audioService.stopRinging();
    };
  }, [callState, activeCallTarget]);

  // 2. WebRTC Peer Signaling Callback Registration
  useEffect(() => {
    webrtcService.setCallbacks(
      (remoteStream) => {
        setPeerState('connected');
        showToast('WebRTC Peer Audio Connected! Two-way audio live across browser tabs.');
      },
      (fromPeerId, callerMeta, sdp) => {
        setIncomingPeerOffer({ fromPeerId, callerMeta, sdp });
      },
      (state) => {
        setPeerState(state);
      }
    );

    return () => {
      webrtcService.setCallbacks(() => {}, () => {}, () => {});
    };
  }, []);

  // 3. Active Call Initialization & Dialogue Start
  useEffect(() => {
    let timer: number | null = null;
    if (callState === 'active') {
      audioService.playConnectChime();

      // Trigger DPDP recording consent gate immediately if pending
      if (recordingConsent === 'pending') {
        setConsentModalOpen(true);
      }

      // Start call timer (ticks only when not on hold)
      timer = window.setInterval(() => {
        if (!isOnHoldRef.current) {
          secondsRef.current += 1;
          setSeconds(secondsRef.current);
        }
      }, 1000);

      // Initialize dialogue through Conversation State Machine
      const sm = stateMachineRef.current || new ConversationStateMachine(activeCallTarget);
      stateMachineRef.current = sm;

      const opening = sm.getOpeningLine();
      if (opening.hasSpeech && opening.text) {
        const initialLine: TranscriptLine = {
          id: `line-${Date.now()}`,
          speaker: 'customer',
          name: activeCallTarget?.name || 'Customer',
          text: opening.text,
          time: '0:01',
        };
        setTranscriptLines([initialLine]);
        transcriptLinesRef.current = [initialLine];

        if (isSpeakerOnRef.current && !isOnHoldRef.current) {
          speechService.speak(opening.text);
        }
      } else {
        // Outbound call: No fake customer speech. Clean start awaiting agent greeting.
        setTranscriptLines([]);
        transcriptLinesRef.current = [];
      }

      // ONLY start microphone analyser & STT if consent has already been granted
      if (recordingConsent === 'granted') {
        speechService.startMicrophone().then((node) => {
          if (node) {
            setAnalyser(node);
            setIsMicActive(true);
          }
        });
        speechService.startSpeechRecognition(
          (text) => handleAgentSpeech(text),
          (err) => {
            setSttError(err);
            showToast(err);
          },
          (status) => {
            setIsSttActive(status === 'listening');
            if (status === 'listening') setSttError(null);
          }
        );
      }
    }

    return () => {
      if (timer) clearInterval(timer);
      if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);
      speechService.stopMicrophone();
      speechService.stopSpeechRecognition();
      speechService.stopSpeaking();
    };
  }, [callState]);

  // 4. Hardware Audio & STT Gating based on DPDP Consent
  useEffect(() => {
    if (callState !== 'active') return;

    if (recordingConsent === 'granted') {
      speechService.startMicrophone().then((node) => {
        if (node) {
          setAnalyser(node);
          setIsMicActive(true);
        }
      });
      speechService.startSpeechRecognition(
        (text) => handleAgentSpeech(text),
        (err) => {
          setSttError(err);
          showToast(err);
        },
        (status) => {
          setIsSttActive(status === 'listening');
          if (status === 'listening') setSttError(null);
        }
      );
    } else if (recordingConsent === 'declined') {
      speechService.stopMicrophone();
      speechService.stopSpeechRecognition();
      setIsMicActive(false);
      setIsSttActive(false);
      setAnalyser(null);
    }
  }, [recordingConsent, callState]);



  // Handle agent speaking (either via physical microphone STT or quick stage prompt)
  const handleAgentSpeech = (text: string) => {
    // If agent is muted or on hold, suppress input
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

    const sm = stateMachineRef.current;
    if (!sm) return;

    // Process speech through Conversation State Machine
    const { customerReply, sopFlag, callCompleted } = sm.processAgentSpeech(text, timeStr);

    // Update state machine observations
    setConversationStage(sm.getCurrentStage());
    setSopChecks({ ...sm.getSopChecks() });
    setSentimentScore(sm.getSentimentScore());
    setSentiment(sm.getSentimentLabel());

    if (sopFlag) {
      showToast(`SOP Achieved: ${sopFlag}`);
    }

    // Customer responds after realistic conversational pause (750ms)
    if (customerReply) {
      if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);
      customerTimeoutRef.current = setTimeout(() => {
        if (isOnHoldRef.current) return;

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
          speechService.speak(customerReply, () => {
            if (callCompleted) {
              // Gracefully end call and open wrap-up upon completion of final courtesy signoff
              setTimeout(() => {
                handleHangup();
              }, 1200);
            }
          });
        } else if (callCompleted) {
          setTimeout(() => {
            handleHangup();
          }, 1200);
        }
      }, 750);
    }
  };

  // Toggle Hardware Microphone Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    isMutedRef.current = nextMuted;
    speechService.setMuted(nextMuted);
    webrtcService.setMuted(nextMuted);
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
      showToast('Call on hold — audio & customer paused');
    } else {
      showToast('Call resumed');
    }
  };

  const handleToggleMic = async () => {
    if (recordingConsent !== 'granted') {
      showToast('DPDP Compliance: Recording consent must be granted before capturing audio.');
      setConsentModalOpen(true);
      return;
    }

    if (isMicActive) {
      speechService.stopMicrophone();
      speechService.stopSpeechRecognition();
      setIsMicActive(false);
      setIsSttActive(false);
      setAnalyser(null);
      showToast('Microphone & speech recognition paused');
    } else {
      const node = await speechService.startMicrophone();
      if (node) {
        setAnalyser(node);
        setIsMicActive(true);
        speechService.startSpeechRecognition(
          (text) => handleAgentSpeech(text),
          (err) => {
            setSttError(err);
            showToast(err);
          },
          (status) => {
            setIsSttActive(status === 'listening');
            if (status === 'listening') setSttError(null);
          }
        );
        showToast('Microphone live — speak to converse with customer');
      } else {
        showToast('Microphone permission required. Use quick prompts below.');
      }
    }
  };


  // Start WebRTC Peer Calling between two tabs
  const handleStartWebRtcPeerCall = async () => {
    if (recordingConsent !== 'granted') {
      showToast('Recording consent required before starting WebRTC voice call.');
      setConsentModalOpen(true);
      return;
    }
    let stream = speechService.getStream();
    if (!stream) {
      const node = await speechService.startMicrophone();
      if (!node) {
        showToast('Microphone access needed for WebRTC peer intercom');
        return;
      }
      stream = speechService.getStream();
    }
    if (stream) {
      await webrtcService.startPeerCall(stream, {
        name: activeCallTarget?.name || 'Customer',
        phone: activeCallTarget?.phone || '+91 98450 12345',
      });
      showToast('WebRTC Outbound Call initiated. Open 2nd tab to accept!');
    }
  };

  // Accept incoming WebRTC Peer Call from 2nd tab
  const handleAcceptIncomingPeerCall = async () => {
    if (!incomingPeerOffer) return;
    let stream = speechService.getStream();
    if (!stream) {
      await speechService.startMicrophone();
      stream = speechService.getStream();
    }
    if (stream) {
      await webrtcService.acceptPeerCall(stream, incomingPeerOffer.fromPeerId, incomingPeerOffer.sdp);
      setIncomingPeerOffer(null);
      setCallState('active');
      showToast('WebRTC Peer Connection Connected! Two-way voice live across tabs.');
    }
  };

  const handleAnswerCall = async () => {
    if (backendCallId) {
      const agentLeg = backendCallDetails?.legs?.find((l) => l.leg_role === 'AGENT');
      const custLeg = backendCallDetails?.legs?.find((l) => l.leg_role === 'CUSTOMER');
      const bothAnswered = agentLeg?.status === 'ANSWERED' && custLeg?.status === 'ANSWERED';

      if (!bothAnswered) {
        showToast(
          'Both physical phones must be answered first. Pick up your handset when it rings; the conference connects automatically.'
        );
        return;
      }

      try {
        await bridgeActiveCall();
      } catch (err) {
        // error notification handled by bridgeActiveCall
      }
      return;
    }
    audioService.stopRinging();
    setCallState('active');
  };

  const handleHangup = () => {
    endCall();
    audioService.stopRinging();
    audioService.playDisconnectTone();
    speechService.stopMicrophone();
    speechService.stopSpeechRecognition();
    speechService.stopSpeaking();
    webrtcService.hangup();
    if (customerTimeoutRef.current) clearTimeout(customerTimeoutRef.current);
    setCallState('wrapup');
    setWrapupOpen(true);
    setConsentModalOpen(false);
  };


  const handleSaveWrapup = (outcomeKey: string, notes: string) => {
    setWrapupOpen(false);

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

    const sm = stateMachineRef.current;
    const finalScore = sm ? sm.calculateFinalSopScore() : 84;

    // Extract genuine verbatim quotes from the actual conversation turns
    const openingEval = sm?.getEvidenceForCriterion('opening') || { passed: true, score: 95, evidence: 'Greeted customer' };
    const discoveryEval = sm?.getEvidenceForCriterion('discovery') || { passed: true, score: 92, evidence: 'Explored spine needs' };
    const pitchEval = sm?.getEvidenceForCriterion('pitch') || { passed: true, score: 94, evidence: 'Presented SmartGRID' };
    const emiEval = sm?.getEvidenceForCriterion('emi') || { passed: true, score: 95, evidence: 'Offered 12-month EMI' };
    const warrantyEval = sm?.getEvidenceForCriterion('warranty') || { passed: true, score: 96, evidence: 'Stated 10-year warranty' };
    const closingEval = sm?.getEvidenceForCriterion('closing') || { passed: true, score: 94, evidence: 'Confirmed WhatsApp & store demo' };

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
      consent: currentConsent || undefined,
      reviewItems: [
        { criterion: 'Opening & Intent Confirm', passed: openingEval.passed, score: openingEval.score, evidence: openingEval.evidence },
        { criterion: 'Needs & Firmness Discovery', passed: discoveryEval.passed, score: discoveryEval.score, evidence: discoveryEval.evidence },
        { criterion: 'Product Pitch', passed: pitchEval.passed, score: pitchEval.score, evidence: pitchEval.evidence },
        { criterion: 'EMI / Financing Mention', passed: emiEval.passed, score: emiEval.score, evidence: emiEval.evidence },
        { criterion: 'Warranty Mention', passed: warrantyEval.passed, score: warrantyEval.score, evidence: warrantyEval.evidence },
        { criterion: 'Closing / Showroom Visit Booking', passed: closingEval.passed, score: closingEval.score, evidence: closingEval.evidence },
      ],
    };

    (callReview as any).notes = notes.trim() || 'No additional notes entered.';

    // Append completed call to AppContext state so Recent Calls tab updates dynamically
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
    resetConsent();
  };


  // Dynamic prompts matching current state machine stage
  const currentStagePrompts = stateMachineRef.current?.getStagePrompts() || [];
  const stageDisplayNames: Record<ConversationStage, string> = {
    greeting: '1. Greeting',
    discovery: '2. Needs Discovery',
    pitch: '3. SmartGRID Pitch',
    objection: '4. Warranty & Financing',
    closing: '5. Showroom Booking',
    completed: 'Complete',
  };

  if (callState === 'idle') {
    // Show incoming WebRTC peer call banner if another browser tab is calling
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
                {incomingPeerOffer.callerMeta?.name || 'Agent (Second Tab)'} ({incomingPeerOffer.callerMeta?.phone || 'WebRTC Intercom'})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIncomingPeerOffer(null)}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold"
            >
              Decline
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-200">
                  Calling Customer • Ringing...
                </span>
                {backendCallId && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] bg-white/20 border border-white/30 text-white px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      {backendCallDetails?.is_simulated ? 'SIMULATED' : 'CARRIER'} ({backendCallDetails?.legs?.[0]?.provider?.toUpperCase() || 'PSTN'}): {backendCallStatus || 'RINGING'}
                    </span>
                    <span className={`text-[10px] border px-2 py-0.5 rounded-full font-mono font-semibold ${backendCallDetails?.legs?.find((l) => l.leg_role === 'AGENT')?.status === 'ANSWERED' ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40' : 'bg-white/10 text-white/80 border-white/20'}`}>
                      Agent: {backendCallDetails?.legs?.find((l) => l.leg_role === 'AGENT')?.status || 'RINGING'}
                    </span>
                    <span className={`text-[10px] border px-2 py-0.5 rounded-full font-mono font-semibold ${backendCallDetails?.legs?.find((l) => l.leg_role === 'CUSTOMER')?.status === 'ANSWERED' ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40' : 'bg-white/10 text-white/80 border-white/20'}`}>
                      Customer: {backendCallDetails?.legs?.find((l) => l.leg_role === 'CUSTOMER')?.status || 'RINGING'}
                    </span>
                  </div>
                )}
              </div>
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
            {backendCallId ? (
              <button
                onClick={handleAnswerCall}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all ${
                  backendCallDetails?.legs?.find((l) => l.leg_role === 'AGENT')?.status === 'ANSWERED' &&
                  backendCallDetails?.legs?.find((l) => l.leg_role === 'CUSTOMER')?.status === 'ANSWERED'
                    ? 'bg-og-green hover:bg-emerald-600 text-white cursor-pointer'
                    : 'bg-white/20 text-white/90 border border-white/30 cursor-pointer hover:bg-white/30'
                }`}
                title="PSTN call automatically transitions to Connected when both physical phones are answered"
              >
                <Phone size={16} />
                <span>
                  {backendCallDetails?.legs?.find((l) => l.leg_role === 'AGENT')?.status === 'ANSWERED' &&
                  backendCallDetails?.legs?.find((l) => l.leg_role === 'CUSTOMER')?.status === 'ANSWERED'
                    ? 'Bridge Confirmed Legs'
                    : 'Awaiting Handset Pickups...'}
                </span>
              </button>
            ) : (
              <button
                onClick={handleAnswerCall}
                className="px-6 py-2.5 bg-og-green hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
              >
                <Phone size={16} />
                <span>Answer / Connect</span>
              </button>
            )}
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
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg font-bold">{activeCallTarget?.name || 'Mukunda R.'}</h3>
                  <span className="text-[11px] bg-white/15 px-2.5 py-0.5 rounded-full font-bold">
                    {activeCallTarget?.phone || '+91 98450 12345'}
                  </span>
                  {backendCallId && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] ${backendCallDetails?.is_simulated ? 'bg-amber-500/30 text-amber-200 border-amber-400/40' : 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40'} border px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${backendCallDetails?.is_simulated ? 'bg-amber-300' : 'bg-emerald-300'}`} />
                        {backendCallDetails?.is_simulated ? 'SIMULATED MOCK' : 'CARRIER LIVE'} ({backendCallDetails?.legs?.[0]?.provider?.toUpperCase() || 'PSTN'}): {backendCallStatus || 'CONNECTED'}
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                        Agent: {backendCallDetails?.legs?.find((l) => l.leg_role === 'AGENT')?.status || 'ANSWERED'}
                      </span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded-full font-mono">
                        Customer: {backendCallDetails?.legs?.find((l) => l.leg_role === 'CUSTOMER')?.status || 'ANSWERED'}
                      </span>
                    </div>
                  )}
                  {peerState === 'connected' && (
                    <span className="text-[10px] bg-teal-400 text-slate-900 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                      <Radio size={10} />
                      Peer WebRTC Live
                    </span>
                  )}

                  {/* DPDP Recording Consent Status Badge */}
                  {recordingConsent === 'granted' && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <ShieldCheck size={11} className="text-emerald-300" />
                      <span>
                        Rec Consent: {currentConsent?.consentId || 'CNS-2026-GRANTED'} ({currentConsent?.method === 'wa' ? 'WhatsApp' : 'Voice'})
                      </span>
                    </span>
                  )}
                  {recordingConsent === 'declined' && (
                    <span className="text-[10px] bg-red-500/20 text-red-200 border border-red-400/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <ShieldAlert size={11} className="text-red-300" />
                      <span>Recording Disabled (Consent Declined)</span>
                    </span>
                  )}
                  {recordingConsent === 'pending' && (
                    <button
                      type="button"
                      onClick={() => setConsentModalOpen(true)}
                      className="text-[10px] bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-300/40 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse transition-colors cursor-pointer"
                      title="DPDP compliance: Customer consent must be verified before recording"
                    >
                      <AlertCircle size={11} className="text-amber-300" />
                      <span>Ask Consent (Pending)</span>
                    </button>
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
                  <span>•</span>
                  <span className="text-xs font-bold text-amber-200 bg-amber-900/40 px-2 py-0.5 rounded-full">
                    {stageDisplayNames[conversationStage]}
                  </span>
                </div>
              </div>
            </div>

            {/* Calling Engine Actions & WebRTC Peer Intercom */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={handleStartWebRtcPeerCall}
                className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 border border-white/10 transition-colors"
                title="Broadcast real WebRTC audio offer to other open tabs"
              >
                <Radio size={12} className={peerState === 'connected' ? 'text-teal-300' : 'text-og-green-light'} />
                <span>{peerState === 'connected' ? 'Peer Intercom Live' : 'Start WebRTC Peer Call'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.open(window.location.href, '_blank');
                  showToast('Opened 2nd tab. Click "Start WebRTC Peer Call" to exchange microphone voice!');
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

          {/* Recording Declined Compliance Banner */}
          {recordingConsent === 'declined' && (
            <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-red-600 flex-shrink-0" />
                <span>
                  <strong>Recording Disabled:</strong> Customer opted out under DPDP regulations. Audio capture and speech transcription are suppressed.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConsentModalOpen(true)}
                className="text-[11px] font-bold text-red-700 hover:text-red-900 underline ml-2 whitespace-nowrap cursor-pointer"
              >
                Re-request Consent
              </button>
            </div>
          )}

          {/* Side-by-Side Active Screen: Transcript (Left) + AI Assist (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <LiveTranscript
                lines={transcriptLines}
                onAgentSpeak={handleAgentSpeech}
                isMicActive={isMicActive}
                onToggleMic={handleToggleMic}
                prompts={currentStagePrompts}
                stageLabel={stageDisplayNames[conversationStage]}
                isSttActive={isSttActive}
                sttError={sttError}
                sttSupported={sttSupported}
              />

            </div>

            <div>
              <AiAssistPanel
                target={activeCallTarget}
                sopChecks={sopChecks}
                onTriggerQuickReply={handleAgentSpeech}
                suggestedText={currentStagePrompts[0]}
                stageLabel={stageDisplayNames[conversationStage]}
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
          onClose={() => {
            setReviewOpen(false);
            resetConsent();
          }}
        />
      )}

      {/* ─── State 5: DPDP Recording Consent Gate Modal ──────────────── */}
      {consentModalOpen && callState === 'active' && (
        <RecordingConsentModal
          callTarget={activeCallTarget}
          onAgree={(method, phone, lang, isMinor, guardianPhone) => {
            const rec = grantConsent(method, phone, lang, isMinor, guardianPhone);
            setConsentModalOpen(false);
            showToast(
              isMinor
                ? `Parent/Guardian consent confirmed · ${rec.consentId}`
                : `Recording consent confirmed · ${rec.consentId}`
            );
          }}
          onRefuse={(method, isMinor, guardianPhone) => {
            declineConsent(method, isMinor, guardianPhone);
            setConsentModalOpen(false);
            showToast(
              isMinor
                ? 'Parent/Guardian declined recording. Continuing unrecorded.'
                : 'Customer declined recording. Continuing unrecorded.'
            );
          }}
          onClose={() => setConsentModalOpen(false)}
        />
      )}


    </div>
  );
}
