import { useState } from 'react';
import { Sparkles, CheckCircle2, Circle, MessageSquare, Bot, HelpCircle, Shield, CreditCard } from 'lucide-react';
import type { CallTarget } from '../../types';

interface AiAssistPanelProps {
  target: CallTarget | null;
  sopChecks: Record<string, boolean>;
  onTriggerQuickReply: (text: string) => void;
}

export default function AiAssistPanel({
  target,
  sopChecks,
  onTriggerQuickReply,
}: AiAssistPanelProps) {
  const sopList = [
    { key: 'opening', label: 'Opening & Intent Confirm' },
    { key: 'discovery', label: 'Needs & Firmness Discovery' },
    { key: 'pitch', label: 'SmartGRID Ergonomic Pitch' },
    { key: 'emi', label: '12-Month Zero-Cost EMI' },
    { key: 'warranty', label: '10-Year Warranty & 100-Night Trial' },
    { key: 'closing', label: 'Closing / Showroom Visit Booking' },
  ];

  const quickReplies = [
    { label: 'Quote 12-Mo EMI', text: 'We have a zero-downpayment 12-month zero-interest EMI on your credit card!' },
    { label: 'Pitch 10-Yr Warranty', text: 'Our patented SmartGRID comes with a full 10-year warranty plus 100 nights risk-free trial in your home.' },
    { label: 'Counter Competitor', text: 'Unlike regular memory foam which sags and traps heat, our grid structure provides active spine relief and air channels.' },
    { label: 'Offer Demo Visit', text: 'I can reserve a private firmness test demo for you at our Koramangala store this afternoon.' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-og-gray-border overflow-hidden shadow-md flex flex-col h-[460px]">
      {/* Header with Purple Gradient matching Mock */}
      <div className="bg-gradient-to-r from-og-purple-mid via-purple-700 to-og-purple-light text-white p-3.5 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Bot size={16} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-200">
              Avani Copilot
            </span>
            <h4 className="text-xs font-bold leading-none">In-Call AI Assist</h4>
          </div>
        </div>
        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
          Live Grounding
        </span>
      </div>

      {/* Body Scroll Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
        {/* Suggested Response Card */}
        <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-og-purple-mid uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={12} />
              Recommended Live Response
            </span>
            <span className="text-[10px] text-purple-700 font-semibold">Grounded in SOP</span>
          </div>

          <p className="text-[#1c1c1e] font-medium leading-relaxed">
            {target?.personaChallenge ||
              'Acknowledge customer interest, validate their spine support needs, and introduce the 12-month zero-interest EMI plan.'}
          </p>

          <button
            onClick={() =>
              onTriggerQuickReply(
                'We have an exclusive 12-month zero-cost EMI starting today, plus a 10-year warranty with 100 nights risk-free trial!'
              )
            }
            className="w-full py-1.5 bg-og-purple-mid hover:bg-purple-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <span>Speak Suggested Pitch</span>
          </button>
        </div>

        {/* Dynamic Live SOP Checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-og-forest uppercase tracking-wider">
              Live SOP Compliance Checklist
            </span>
            <span className="text-[11px] font-bold text-og-green">
              {Object.values(sopChecks).filter(Boolean).length}/{sopList.length} Checked
            </span>
          </div>

          <div className="space-y-1.5">
            {sopList.map((item) => {
              const isChecked = sopChecks[item.key] ?? false;
              return (
                <div
                  key={item.key}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-all ${
                    isChecked
                      ? 'bg-emerald-50/60 border-emerald-200 text-og-forest font-semibold'
                      : 'bg-og-gray/40 border-og-gray-border text-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isChecked ? (
                      <CheckCircle2 size={15} className="text-og-green flex-shrink-0" />
                    ) : (
                      <Circle size={15} className="text-gray-300 flex-shrink-0" />
                    )}
                    <span className="text-xs">{item.label}</span>
                  </div>
                  {isChecked && (
                    <span className="text-[10px] font-bold text-og-green">Passed</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Reply Action Chips */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-og-forest uppercase tracking-wider">
            Quick Counter Chips
          </span>

          <div className="grid grid-cols-2 gap-1.5">
            {quickReplies.map((qr) => (
              <button
                key={qr.label}
                onClick={() => onTriggerQuickReply(qr.text)}
                className="p-2 bg-og-gray hover:bg-purple-50 hover:text-purple-800 border border-og-gray-border hover:border-purple-200 rounded-lg text-left text-[11px] font-semibold text-[#1c1c1e] transition-colors leading-tight"
              >
                {qr.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
