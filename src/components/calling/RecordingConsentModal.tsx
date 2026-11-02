import { useState } from 'react';
import {
  ShieldCheck,
  Send,
  Check,
  X,
  MessageSquare,
  Mic,
  AlertCircle,
  ExternalLink,
  Users,
} from 'lucide-react';
import type { CallTarget } from '../../types';

interface RecordingConsentModalProps {
  callTarget: CallTarget | null;
  onAgree: (
    method: 'voice' | 'wa',
    phone?: string,
    lang?: string,
    isMinor?: boolean,
    guardianPhone?: string
  ) => void;
  onRefuse: (
    method?: 'voice' | 'wa',
    isMinor?: boolean,
    guardianPhone?: string
  ) => void;
  onClose: () => void;
}

type ConsentLang = 'kn' | 'hi' | 'en';
type ConsentMode = 'voice' | 'wa';

export default function RecordingConsentModal({
  callTarget,
  onAgree,
  onRefuse,
  onClose,
}: RecordingConsentModalProps) {
  const [lang, setLang] = useState<ConsentLang>('en');
  const [mode, setMode] = useState<ConsentMode>('voice');
  const [phone, setPhone] = useState<string>(() => {
    return (callTarget?.phone || '').replace(/\D/g, '').slice(-10) || '9845012345';
  });
  const [guardianPhone, setGuardianPhone] = useState<string>('');
  const [isMinor, setIsMinor] = useState(false);
  const [waSent, setWaSent] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Localized compliance scripts matching mock
  const scripts: Record<ConsentLang, { title: string; script: string; reassure: string }> = {
    kn: {
      title: 'ಕನ್ನಡ (Kannada)',
      script:
        'ಈ ಕಾಲ್ ಅನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡಬಹುದಾ? ಇದು ನಿಮ್ಮ ಸರ್ವೀಸ್ ಮತ್ತು ಫಾಲೋ-ಅಪ್‌ಗೆ ಮಾತ್ರ. ಬೇಡ ಅನ್ನಬಹುದು, ಯಾವಾಗ ಬೇಕಾದರೂ ಡಿಲೀಟ್ ಮಾಡಿಸಬಹುದು.',
      reassure: 'ರೆಕಾರ್ಡ್ ಮಾಡೋದು ನಿಮ್ಮ ಇಷ್ಟ. ಬೇಡ ಅಂದ್ರೆ ನಿಮಗೆ ಏನೂ ತೊಂದರೆ ಇಲ್ಲ.',
    },
    hi: {
      title: 'हिन्दी (Hindi)',
      script:
        'क्या हम यह कॉल रिकॉर्ड कर सकते हैं? सिर्फ़ आपकी सर्विस और फ़ॉಲೋ-अप के लिए है। आप मना कर सकते हैं, या कभी भी डिलीट करवा सकते हैं।',
      reassure: 'रिकॉर्डिंग आपकी मर्ज़ी है। मना करने से आपकी सर्विस पर कोई असर नहीं पड़ेगा।',
    },
    en: {
      title: 'English',
      script:
        'Can we record this call? Only for your service and follow-up. You can say no, or ask us to delete it any time.',
      reassure: "Recording is your choice. Saying no won't change anything for you.",
    },
  };

  // Strictly isolate activePhone: When isMinor is true, ALWAYS require guardianPhone. Never fall back to customer phone.
  const activePhone = isMinor ? guardianPhone : phone;

  const validatePhone = (): boolean => {
    const rawNumber = isMinor ? guardianPhone : phone;
    const cleaned = rawNumber.replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setPhoneError(
        isMinor
          ? 'Enter a valid 10-digit parent/guardian mobile number.'
          : 'Enter a valid 10-digit customer mobile number.'
      );
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleSendWhatsApp = () => {
    if (!validatePhone()) return;
    setWaSent(true);
  };

  const handleVoiceYes = () => {
    if (isMinor && !validatePhone()) return;
    onAgree('voice', isMinor ? guardianPhone : phone, lang, isMinor, isMinor ? guardianPhone : undefined);
  };

  const handleVoiceNo = () => {
    if (isMinor && !validatePhone()) return;
    onRefuse('voice', isMinor, isMinor ? guardianPhone : undefined);
  };

  const handleWaReply = (agreed: boolean) => {
    if (isMinor && !validatePhone()) return;
    if (agreed) {
      onAgree('wa', isMinor ? guardianPhone : phone, lang, isMinor, isMinor ? guardianPhone : undefined);
    } else {
      onRefuse('wa', isMinor, isMinor ? guardianPhone : undefined);
    }
  };

  // Real WhatsApp Web / App delivery link
  const waComplianceMessage = `Namaste from The Sleep Company. Under DPDP compliance regulations, may we have consent to record this call for service quality and follow-up?\n\nPlease reply *YES* to agree or *NO* to opt-out.`;
  const realWaUrl = `https://wa.me/91${activePhone.replace(/\D/g, '')}?text=${encodeURIComponent(
    waComplianceMessage
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-gate-title"
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />

        <div className="relative w-full max-w-md bg-white rounded-sheet shadow-2xl overflow-hidden border border-gray-200 animate-fade-in z-10">
          {/* Header */}
          <div className="bg-white border-b border-gray-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-og-green-bg text-og-forest flex items-center justify-center shadow-xs">
                <ShieldCheck size={20} className="text-og-green" />
              </span>
              <div>
                <h3 id="consent-gate-title" className="text-sm font-bold text-gray-900 leading-tight">
                  Ask before you record
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Call Centre · {callTarget?.name || 'Customer'}{' '}
                  {isMinor && <span className="text-blue-800 font-bold">(Minor / Under 18)</span>}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
              aria-label="Dismiss consent dialog"
            >
              <X size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 text-xs">
            {/* Step 1: Script */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-gray-900 text-white font-bold text-[10px] flex items-center justify-center">
                  1
                </span>
                <span className="font-bold text-gray-800 text-xs uppercase tracking-wide">
                  Say this · Right after hello
                </span>
              </div>

              {/* Language Pills */}
              <div className="flex items-center gap-1.5 mb-2">
                {(['en', 'kn', 'hi'] as ConsentLang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                      lang === l
                        ? 'bg-og-forest text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {l === 'en' ? 'English' : l === 'kn' ? 'ಕನ್ನಡ' : 'हिन्दी'}
                  </button>
                ))}
              </div>

              {/* Script Box */}
              <div className="bg-[#f1f8f5] border-l-3 border-og-forest p-3 rounded-r-lg space-y-1.5">
                <p className="text-xs font-medium text-gray-900 leading-relaxed">
                  "{scripts[lang].script}"
                </p>
                {lang !== 'en' && (
                  <p className="text-[11px] text-gray-500 italic">
                    "{scripts.en.script}"
                  </p>
                )}
                <div className="text-[10.5px] text-og-forest font-semibold pt-1 border-t border-og-green/20">
                  {scripts[lang].reassure}
                </div>
              </div>
            </div>

            {/* Step 2: Verification Mode */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-gray-900 text-white font-bold text-[10px] flex items-center justify-center">
                  2
                </span>
                <span className="font-bold text-gray-800 text-xs uppercase tracking-wide">
                  Get their consent
                </span>
              </div>

              {/* Tabs */}
              <div className="flex bg-gray-100 p-0.5 rounded-lg mb-3">
                <button
                  type="button"
                  onClick={() => setMode('voice')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'voice'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Mic size={13} />
                  <span>Said out loud (Voice)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('wa')}
                  className={`flex-1 py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'wa'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>On WhatsApp</span>
                </button>
              </div>

              {/* Under-18 / Minor Toggle Button (Matching Mock toggle) */}
              <div className="mb-3 p-2.5 rounded-xl border border-blue-100 bg-blue-50/50 flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                    <Users size={14} className="text-blue-900" />
                    <span>Under 18?</span>
                  </span>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {mode === 'wa'
                      ? "Send it to a parent's number instead."
                      : 'A parent or guardian must say yes.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isMinor}
                  onClick={() => {
                    setIsMinor(!isMinor);
                    setWaSent(false);
                    setPhoneError('');
                  }}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    isMinor ? 'bg-[#1e3a8a]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isMinor ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Parent Phone input if Minor */}
              {isMinor && (
                <div className={`mb-3 p-2.5 rounded-xl space-y-1 transition-all ${phoneError ? 'bg-red-50 border border-red-300' : 'bg-blue-50 border border-blue-200'}`}>
                  <label className="text-[11px] font-bold text-blue-950 block">
                    Parent / Guardian's Mobile Number (Mandatory)
                  </label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-2.5 bg-white border border-blue-200 rounded-lg text-gray-500 font-semibold text-xs">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={guardianPhone}
                      onChange={(e) => {
                        setGuardianPhone(e.target.value);
                        setPhoneError('');
                      }}
                      placeholder="Parent's 10-digit number"
                      className={`flex-1 px-3 py-1.5 bg-white rounded-lg text-xs font-semibold text-gray-900 focus:outline-hidden focus:ring-2 ${
                        phoneError ? 'border border-red-500 focus:ring-red-400' : 'border border-blue-300 focus:ring-blue-600'
                      }`}
                      maxLength={10}
                    />
                  </div>
                  {phoneError ? (
                    <p className="text-[11px] text-red-600 font-medium flex items-center gap-1 pt-0.5">
                      <AlertCircle size={12} /> {phoneError}
                    </p>
                  ) : (
                    <p className="text-[10px] text-blue-800">
                      Consent will be registered under guardian verification.
                    </p>
                  )}
                </div>
              )}

              {/* Tab 1: Voice Verbal Confirmation */}
              {mode === 'voice' && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleVoiceYes}
                      className="p-2.5 bg-og-forest hover:bg-og-forest/90 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <Check size={16} strokeWidth={2.5} />
                      <span>{isMinor ? 'Parent said yes' : 'They said yes'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleVoiceNo}
                      className="p-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <X size={16} strokeWidth={2.5} />
                      <span>{isMinor ? 'Parent said no' : 'They said no'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 text-center">
                    {isMinor
                      ? 'Parent or guardian spoken consent is saved as verified proof.'
                      : "Customer's spoken yes is saved as a verified timestamp proof."}
                  </p>
                </div>
              )}

              {/* Tab 2: WhatsApp Link Flow */}
              {mode === 'wa' && (
                <div className="space-y-3">
                  {!waSent ? (
                    <div>
                      <div className="flex gap-2">
                        <div className="flex items-center px-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 font-semibold text-xs">
                          +91
                        </div>
                        <input
                          type="tel"
                          value={activePhone}
                          onChange={(e) => {
                            if (isMinor) setGuardianPhone(e.target.value);
                            else setPhone(e.target.value);
                          }}
                          placeholder={isMinor ? "Parent's 10-digit number" : '10-digit number'}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-og-green"
                          maxLength={10}
                        />
                        <button
                          type="button"
                          onClick={handleSendWhatsApp}
                          className="px-3.5 py-2 bg-og-green hover:bg-og-forest text-white rounded-lg font-bold flex items-center gap-1 shadow-sm transition-colors"
                        >
                          <Send size={13} />
                          <span>Send</span>
                        </button>
                      </div>
                      {phoneError && (
                        <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                          <AlertCircle size={12} /> {phoneError}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-500 mt-1.5">
                        {isMinor
                          ? "Parent receives compliance message on WhatsApp and taps Yes or No."
                          : 'They receive the compliance text via WhatsApp and tap Yes or No.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                            <span>Sent to +91 {activePhone}</span>
                          </div>

                          {/* Real WhatsApp Web/App launcher */}
                          <a
                            href={realWaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline bg-emerald-100/60 px-2 py-0.5 rounded"
                            title="Open prefilled WhatsApp message in WhatsApp Web/App"
                          >
                            <span>Open in WhatsApp</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                        <p className="text-[11.5px] text-amber-800 mt-1.5 leading-normal">
                          Say: “I've sent the consent confirmation to your {isMinor ? "parent's " : ''}WhatsApp. Just tap Yes or No.” Recording stays off until consented.
                        </p>
                      </div>

                      {/* Simulation Controls for testing WhatsApp tap */}
                      <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-amber-400 text-amber-950 rounded text-[9px] font-black">
                            SIMULATE TAP
                          </span>
                          <span className="text-[11px] text-gray-600 font-medium">
                            {isMinor ? 'Parent taps:' : 'Customer taps:'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleWaReply(true)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => handleWaReply(false)}
                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => setWaSent(false)}
                            className="text-[10px] text-og-green hover:underline ml-1 font-semibold cursor-pointer"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer Note */}
          <div className="bg-gray-50 p-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
            <span>DPDP Compliance 2026 {isMinor ? '· Sec 9 Minor Guard' : ''}</span>
            <span>A "No" logs refusal & continues unrecorded</span>
          </div>
        </div>
      </div>
    </div>
  );
}
