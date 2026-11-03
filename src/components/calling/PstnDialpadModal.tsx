import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Phone,
  PhoneCall,
  X,
  Delete,
  ShieldCheck,
  Radio,
  Sparkles,
  Info,
} from 'lucide-react';

export default function PstnDialpadModal() {
  const {
    dialpadModalOpen,
    setDialpadModalOpen,
    startCall,
    showToast,
  } = useApp();

  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [customerName, setCustomerName] = useState('Customer');
  const [notes, setNotes] = useState('Direct PSTN outbound call');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!dialpadModalOpen) return null;

  const handleDigitClick = (digit: string) => {
    setValidationError(null);
    setPhoneNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setValidationError(null);
    setPhoneNumber((prev) => (prev.length > 3 ? prev.slice(0, -1) : '+91'));
  };

  const handleClear = () => {
    setValidationError(null);
    setPhoneNumber('+91');
  };

  const handleDial = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // E.164 validation check: must start with + and have 8 to 15 digits
    const e164Regex = /^\+[1-9]\d{7,14}$/;
    if (!e164Regex.test(clean)) {
      setValidationError('Please enter a valid E.164 telephone number (e.g. +919876543210)');
      return;
    }

    setDialpadModalOpen(false);

    // Trigger authentic outbound PSTN call
    startCall({
      id: `manual-${Date.now()}`,
      name: customerName.trim() || 'PSTN Recipient',
      initials: (customerName.trim() || 'CU').slice(0, 2).toUpperCase(),
      phone: clean,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 animate-scale-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-og-night to-[#2d2d5f] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-og-green/20 border border-og-green/40 flex items-center justify-center text-og-green-light">
              <PhoneCall size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Real PSTN Outbound Dial</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold">
                  Carrier Live
                </span>
              </h3>
              <p className="text-xs text-gray-300 mt-0.5">
                Dials a genuine telephone on physical cellular network
              </p>
            </div>
          </div>
          <button
            onClick={() => setDialpadModalOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleDial} className="p-5 space-y-4">
          {/* Live PSTN Notice */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-og-forest mt-0.5 flex-shrink-0" />
            <div className="text-xs text-og-forest">
              <span className="font-bold">Real Telephony Gateway Active: </span>
              Calls initiated here trigger genuine PSTN ringing on real cellular handsets.
            </div>
          </div>

          {/* Number Display & Input */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Destination Phone Number (E.164)
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
                className="w-full text-xl font-bold tracking-wider px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-og-green focus:border-transparent font-mono"
              />
              {phoneNumber.length > 3 && (
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="absolute right-3 p-2 text-gray-400 hover:text-gray-700 transition-colors"
                  title="Backspace"
                >
                  <Delete size={18} />
                </button>
              )}
            </div>
            {validationError && (
              <p className="text-xs text-red-600 font-semibold mt-1">{validationError}</p>
            )}
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-gray-500 font-medium whitespace-nowrap">Quick fill:</span>
            <button
              type="button"
              onClick={() => setPhoneNumber('+919876543210')}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-mono whitespace-nowrap"
            >
              +919876543210
            </button>
            <button
              type="button"
              onClick={() => setPhoneNumber('+919845012345')}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[11px] font-mono whitespace-nowrap"
            >
              +919845012345
            </button>
          </div>

          {/* Dialpad Grid */}
          <div className="grid grid-cols-3 gap-2 py-1">
            {dialpadKeys.map((k) => (
              <button
                key={k.num}
                type="button"
                onClick={() => handleDigitClick(k.num)}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-gray-50 hover:bg-emerald-50 hover:border-emerald-200 border border-gray-200 text-gray-800 transition-all active:scale-95 shadow-xs"
              >
                <span className="text-lg font-bold leading-none">{k.num}</span>
                {k.sub && (
                  <span className="text-[9px] text-gray-600 font-semibold mt-0.5 tracking-widest">
                    {k.sub}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Recipient Details */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                Recipient Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Rohan Sharma"
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-og-green"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1">
                Call Purpose / Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="SmartGRID mattress inquiry"
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-og-green"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDialpadModalOpen(false)}
              className="flex-1 py-3 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 text-xs font-bold text-white bg-og-green hover:bg-emerald-600 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 hover:shadow-lg"
            >
              <Phone size={16} />
              <span>Dial PSTN Call</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
