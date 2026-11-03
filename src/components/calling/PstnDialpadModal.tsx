import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { isConfiguredBackendAvailable } from '../../services/telephonyApi';
import {
  Phone,
  PhoneCall,
  X,
  Delete,
  ShieldCheck,
  User,
  AlertTriangle,
  ServerOff,
} from 'lucide-react';

export default function PstnDialpadModal({ isOpen }: { isOpen?: boolean } = {}) {
  const {
    dialpadModalOpen: contextOpen,
    setDialpadModalOpen,
    startCall,
    telephonyError,
  } = useApp();

  const dialpadModalOpen = isOpen !== undefined ? isOpen : contextOpen;

  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [agentPhone, setAgentPhone] = useState(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('onground_agent_phone') : '') || '';
  });
  const [customerName, setCustomerName] = useState('Customer');
  const [notes, setNotes] = useState('Direct PSTN outbound call');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Requirement 9: Prevent background-page scrolling while modal is open
  useEffect(() => {
    if (!dialpadModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [dialpadModalOpen]);

  if (!dialpadModalOpen) return null;

  const isBackendAvailable = isConfiguredBackendAvailable();

  const handleDigitClick = (digit: string) => {
    setValidationError(null);
    setPhoneNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setValidationError(null);
    setPhoneNumber((prev) => (prev.length > 3 ? prev.slice(0, -1) : '+91'));
  };

  const handleDial = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCustomer = phoneNumber.replace(/[\s\-\(\)]/g, '');
    const cleanAgent = agentPhone.trim().replace(/[\s\-\(\)]/g, '');

    // Requirement 7: Do not pretend production backend is deployed if no backend deployment exists
    if (!isBackendAvailable) {
      setValidationError(
        'FastAPI backend not configured. Outbound PSTN calling requires VITE_BACKEND_API_URL set to a live FastAPI server in Vercel settings.'
      );
      return;
    }

    // E.164 validation check: must start with + and have 8 to 15 digits
    const e164Regex = /^\+[1-9]\d{7,14}$/;
    if (!e164Regex.test(cleanCustomer)) {
      setValidationError('Please enter a valid E.164 customer phone number (e.g. +919876543210)');
      return;
    }

    if (cleanAgent && !e164Regex.test(cleanAgent)) {
      setValidationError('Agent phone number must be in E.164 format (e.g. +919876543210)');
      return;
    }

    if (cleanAgent && typeof window !== 'undefined') {
      localStorage.setItem('onground_agent_phone', cleanAgent);
    }

    setDialpadModalOpen(false);

    // Trigger authentic outbound PSTN call
    startCall({
      id: `manual-${Date.now()}`,
      name: customerName.trim() || 'PSTN Recipient',
      initials: (customerName.trim() || 'CU').slice(0, 2).toUpperCase(),
      phone: cleanCustomer,
      agentPhone: cleanAgent || undefined,
      avatarBg: '#e1f5ee',
      avatarColor: '#0f6e56',
      intent: notes.trim() || 'Direct Real PSTN Outbound Call',
      product: 'Live Telephony Call',
      value: '₹12,490',
    });
  };

  const dialpadKeys = [
    { num: '1', sub: '' },
    { num: '2', sub: 'ABC' },
    { num: '3', sub: 'DEF' },
    { num: '4', sub: 'GHI' },
    { num: '5', sub: 'JKL' },
    { num: '6', sub: 'MNO' },
    { num: '7', sub: 'PQRS' },
    { num: '8', sub: 'TUV' },
    { num: '9', sub: 'WXYZ' },
    { num: '*', sub: '' },
    { num: '0', sub: '+' },
    { num: '#', sub: '' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PSTN Outbound Dial"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-[2px] animate-fade-in"
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col animate-scale-up"
        style={{
          width: 'min(480px, calc(100vw - 24px))',
          maxHeight: 'min(88dvh, 780px)',
        }}
      >
        {/* Header - Fixed & Always Visible (flex-shrink-0, Requirement 6) */}
        <div className="flex-shrink-0 bg-gradient-to-r from-og-night to-[#2d2d5f] text-white p-3.5 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-og-green/20 border border-og-green/40 flex items-center justify-center text-og-green-light flex-shrink-0">
              <PhoneCall size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-1.5 sm:gap-2">
                <span>PSTN Outbound Dial</span>
                <span className="text-[9px] sm:text-[10px] bg-sky-500/20 text-sky-300 border border-sky-400/30 px-1.5 sm:px-2 py-0.5 rounded-full font-bold">
                  Two-Leg Gateway
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-gray-300 mt-0.5">
                Initiate authentic carrier call to your handset and customer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDialpadModalOpen(false)}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form - flex column wrapper */}
        <form onSubmit={handleDial} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Scrollable Content Body (Requirements 5 & 8) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3">
            {/* Telephony Error Alert */}
            {telephonyError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 sm:p-3 flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-[11px] sm:text-xs text-red-800 leading-snug">
                  <span className="font-bold">Last Dispatch Note: </span>
                  {telephonyError}
                </div>
              </div>
            )}

            {/* Requirement 7: Missing Backend Warning Banner in Production */}
            {!isBackendAvailable && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 sm:p-3 flex items-start gap-2">
                <ServerOff size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-[11px] sm:text-xs text-amber-900 leading-snug">
                  <span className="font-bold">FastAPI Backend Not Connected: </span>
                  This production host has no <code className="bg-amber-100/90 px-1 py-0.5 rounded font-mono text-[10px] text-amber-900">VITE_BACKEND_API_URL</code> configured. Outbound PSTN calls require an active FastAPI server with Twilio/Exotel credentials.
                </div>
              </div>
            )}

            {/* Telephony Gateway Notice */}
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 sm:p-3 flex items-start gap-2">
              <ShieldCheck size={15} className="text-sky-700 mt-0.5 flex-shrink-0" />
              <div className="text-[11px] sm:text-xs text-sky-800 leading-snug">
                <span className="font-bold">Two-Leg Bridge: </span>
                The carrier calls your Agent handset first, then rings the Customer handset and bridges both into a live conference.
              </div>
            </div>

            {/* Agent Phone (Your Handset) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User size={12} className="text-og-green" />
                  <span>Your Agent Mobile Phone (E.164)</span>
                </label>
                <span className="text-[10px] text-gray-400 font-medium">Overrides DEV_AGENT_PHONE</span>
              </div>
              <input
                type="tel"
                value={agentPhone}
                onChange={(e) => {
                  setValidationError(null);
                  setAgentPhone(e.target.value);
                }}
                placeholder="+9198XXXXXXXX (Your Phone)"
                className="w-full text-xs sm:text-sm font-semibold px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-og-green font-mono"
              />
              <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5">
                Your physical phone will ring first. Leave blank only if DEV_AGENT_PHONE is set in .env.
              </p>
            </div>

            {/* Number Display & Input */}
            <div>
              <label className="block text-[11px] sm:text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Customer Destination Phone Number (E.164)
              </label>
              <div className="relative flex items-center">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setValidationError(null);
                    setPhoneNumber(e.target.value);
                  }}
                  placeholder="+919876543210"
                  className="w-full text-lg sm:text-xl font-bold tracking-wider px-3.5 sm:px-4 py-2 sm:py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-og-green focus:border-transparent font-mono"
                />
                {phoneNumber.length > 3 && (
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="absolute right-2.5 p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                    title="Backspace"
                  >
                    <Delete size={17} />
                  </button>
                )}
              </div>
              {validationError && (
                <p className="text-xs text-red-600 font-semibold mt-1">{validationError}</p>
              )}
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
              <span className="text-gray-500 font-medium whitespace-nowrap text-[11px]">Quick fill:</span>
              <button
                type="button"
                onClick={() => setPhoneNumber('+919876543210')}
                className="px-2 py-0.5 sm:py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] sm:text-[11px] font-mono whitespace-nowrap cursor-pointer"
              >
                +919876543210
              </button>
              <button
                type="button"
                onClick={() => setPhoneNumber('+919845012345')}
                className="px-2 py-0.5 sm:py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] sm:text-[11px] font-mono whitespace-nowrap cursor-pointer"
              >
                +919845012345
              </button>
            </div>

            {/* Dialpad Grid - Compact Keypad Height (Requirement 10) */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 py-0.5">
              {dialpadKeys.map((k) => (
                <button
                  key={k.num}
                  type="button"
                  onClick={() => handleDigitClick(k.num)}
                  className="flex flex-col items-center justify-center h-9 sm:h-11 rounded-lg sm:rounded-xl bg-gray-50 hover:bg-emerald-50 hover:border-emerald-200 border border-gray-200 text-gray-800 transition-all active:scale-95 shadow-xs cursor-pointer"
                >
                  <span className="text-base sm:text-lg font-bold leading-none">{k.num}</span>
                  {k.sub && (
                    <span className="text-[8px] sm:text-[9px] text-gray-500 font-semibold mt-0.5 tracking-wider">
                      {k.sub}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Recipient Details */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-gray-600 uppercase mb-0.5">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Rohan Sharma"
                  className="w-full text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-og-green"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-[11px] font-bold text-gray-600 uppercase mb-0.5">
                  Call Purpose / Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="SmartGRID mattress inquiry"
                  className="w-full text-xs px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-og-green"
                />
              </div>
            </div>
          </div>

          {/* Primary Action Buttons - Fixed & Always Accessible at Bottom (Requirement 7) */}
          <div className="flex-shrink-0 p-3 sm:p-4 bg-gray-50/90 border-t border-gray-100 flex items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setDialpadModalOpen(false)}
              className="flex-1 py-2.5 sm:py-3 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 sm:py-3 text-xs font-bold text-white bg-og-green hover:bg-emerald-600 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 hover:shadow-lg cursor-pointer"
            >
              <Phone size={15} />
              <span>Dial PSTN Call</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
