// Intelligent Conversation State Machine & Customer Persona Engine
// Manages conversational turns, stage sequencing, persona memory, dynamic sentiment, and SOP verification.

export type ConversationStage =
  | 'greeting'
  | 'discovery'
  | 'pitch'
  | 'objection'
  | 'closing'
  | 'completed';

export interface CustomerPersona {
  id: string;
  name: string;
  initials: string;
  phone: string;
  callDirection: 'inbound' | 'outbound';
  productInterest: string;
  budgetOrFinancing: string;
  painPoint: string;
  mainObjection: string;
  closingGoal: string;
  inboundOpening?: string;
  outboundOpeningResponse: string;
  discoveryResponse: string;
  pitchReaction: string;
  objectionResponse: string;
  closingAgreement: string;
}

export const CUSTOMER_PERSONAS: Record<string, CustomerPersona> = {
  // Mukunda R. — Outbound High Propensity Lead (Ortho GRID)
  lead_1: {
    id: 'lead_1',
    name: 'Mukunda R.',
    initials: 'MR',
    phone: '+91 98450 12345',
    callDirection: 'outbound',
    productInterest: 'Ortho GRID Mattress (Queen)',
    budgetOrFinancing: 'Prefers 12-month zero-interest credit card EMI',
    painPoint: 'Chronic lower back stiffness after 9-hour desk shifts',
    mainObjection: 'Worried that grid structure might sag or feel too firm after 6 months',
    closingGoal: 'Saturday 4:00 PM private demo at Koramangala store + WhatsApp quote',
    outboundOpeningResponse:
      'Hello Arvind! Thanks for following up. Yes, I was checking out your Ortho GRID mattress online yesterday after work.',
    discoveryResponse:
      'I spend 8 to 9 hours sitting at a laptop and wake up with stiffness in my lower lumbar. My current foam mattress feels hot and saggy.',
    pitchReaction:
      'The SmartGRID posture alignment sounds promising. But how does it hold up over time? Does the hyper-elastic gel sag?',
    objectionResponse:
      'A 10-year warranty with 100 nights trial makes me feel much more confident. And zero-interest on 12 months EMI fits my monthly budget perfectly.',
    closingAgreement:
      'Sounds great, Arvind! Please send the breakdown on WhatsApp and book me a slot this Saturday at 4:00 PM at your Koramangala store.',
  },

  // Priya Iyer — Inbound Missed / Billing Dispute
  ic1: {
    id: 'ic1',
    name: 'Priya Iyer',
    initials: 'PI',
    phone: '+91 98450 67890',
    callDirection: 'inbound',
    productInterest: 'SmartGRID Luxe & EMI Statement',
    budgetOrFinancing: 'Pre-approved EMI plan with disputed fee',
    painPoint: 'Disputed ₹1,200 handling charge on recent EMI invoice',
    mainObjection: 'Unexplained fee deduction and slow response on email',
    closingGoal: 'Fee waiver confirmation within 2 hours + credit receipt on WhatsApp',
    inboundOpening:
      "Hello, is this The Sleep Company? I've called twice about an unexpected ₹1,200 charge on my EMI statement.",
    outboundOpeningResponse:
      "Hello, yes! I'm glad you called back. I've been trying to get an answer about an extra charge on my invoice.",
    discoveryResponse:
      'My invoice shows an additional ₹1,200 processing fee that was supposed to be waived under the zero-interest offer.',
    pitchReaction:
      'Thank you for looking into the invoice so quickly. Can you confirm the exact waiver timeline?',
    objectionResponse:
      'If you can process the reversal to my statement today, that resolves my main complaint.',
    closingAgreement:
      'Thank you Arvind. Please send me the reversal ticket number and revised statement copy on WhatsApp.',
  },

  // Rohan P. — Outbound Luxe Inquirer
  lead_2: {
    id: 'lead_2',
    name: 'Rohan P.',
    initials: 'RP',
    phone: '+91 98450 23456',
    callDirection: 'outbound',
    productInterest: 'SmartGRID Luxe (King)',
    budgetOrFinancing: 'Premium buyer, interested in plush cooling and protector bundle',
    painPoint: 'Disturbed sleep from partner movement and heat trapped by memory foam',
    mainObjection: 'Wants to test zero-motion transfer in showroom before paying ₹38,000',
    closingGoal: 'VIP Store trial booking with ASM Ravi Kumar',
    outboundOpeningResponse:
      'Hi Arvind! Yes, I was browsing your SmartGRID Luxe King mattress for our new master bedroom.',
    discoveryResponse:
      'My wife is a light sleeper, so motion isolation and temperature control are our top priorities.',
    pitchReaction:
      'The 2500+ air channels and zero motion transfer sound ideal. Can we test lying down together before purchasing?',
    objectionResponse:
      'Including the waterproof mattress protector and free white-glove delivery makes the package very appealing.',
    closingAgreement:
      'Perfect! Lock in my Saturday 2:00 PM trial at Koramangala. Looking forward to meeting your team.',
  },

  // Fallback Persona for other leads/scenarios
  generic: {
    id: 'generic',
    name: 'Customer',
    initials: 'CU',
    phone: '+91 98450 00000',
    callDirection: 'outbound',
    productInterest: 'SmartGRID Orthopedic Mattress',
    budgetOrFinancing: 'Flexible financing',
    painPoint: 'Looking for better spinal support and cooler sleep',
    mainObjection: 'Needs assurance on warranty and return policy',
    closingGoal: 'Showroom test visit + official price quote on WhatsApp',
    outboundOpeningResponse:
      'Hello Arvind! Thanks for calling. I was indeed inquiring about your ergonomic mattresses.',
    discoveryResponse:
      'I need good lower back support and something that stays cool during humid nights.',
    pitchReaction:
      'The patented grid design makes sense. What kind of guarantee and trial period do you provide?',
    objectionResponse:
      '10 years warranty and zero-cost EMI sounds reassuring.',
    closingAgreement:
      'Wonderful, please WhatsApp me the quote and I will visit your Koramangala store this weekend.',
  },
};

export interface ConversationTurn {
  speaker: 'agent' | 'customer';
  name: string;
  text: string;
  time: string;
  stage: ConversationStage;
  sopFlag?: string;
}

export class ConversationStateMachine {
  private persona: CustomerPersona;
  private currentStage: ConversationStage = 'greeting';
  private turns: ConversationTurn[] = [];
  private sentimentScore: number = 78;
  private isOutbound: boolean = true;
  private hasAgentGreeted: boolean = false;
  private hasDiscoveredNeeds: boolean = false;
  private hasPitchedProduct: boolean = false;
  private hasAddressedFinance: boolean = false;
  private hasAddressedWarranty: boolean = false;
  private hasClosedGoal: boolean = false;

  constructor(personaKey?: string, isOutbound: boolean = true) {
    this.persona = CUSTOMER_PERSONAS[personaKey || ''] || CUSTOMER_PERSONAS.generic;
    this.isOutbound = isOutbound;
    this.currentStage = 'greeting';
    // Inbound dispute starts at lower sentiment
    this.sentimentScore = this.persona.id === 'ic1' ? 58 : 78;
  }

  getPersona(): CustomerPersona {
    return this.persona;
  }

  getCurrentStage(): ConversationStage {
    return this.currentStage;
  }

  getSentimentScore(): number {
    return this.sentimentScore;
  }

  getSentimentLabel(): 'Positive' | 'Neutral' | 'Skeptical' {
    if (this.sentimentScore >= 80) return 'Positive';
    if (this.sentimentScore >= 65) return 'Neutral';
    return 'Skeptical';
  }

  getSopChecks(): Record<string, boolean> {
    return {
      opening: this.hasAgentGreeted,
      discovery: this.hasDiscoveredNeeds,
      pitch: this.hasPitchedProduct,
      emi: this.hasAddressedFinance,
      warranty: this.hasAddressedWarranty,
      closing: this.hasClosedGoal,
    };
  }

  // Get initial opening line for the call
  getOpeningLine(): { speaker: 'agent' | 'customer'; text: string } {
    if (!this.isOutbound && this.persona.inboundOpening) {
      // Inbound: Customer speaks first
      return {
        speaker: 'customer',
        text: this.persona.inboundOpening,
      };
    } else {
      // Outbound: System tells agent to speak opening
      return {
        speaker: 'customer',
        text: `[Incoming connection established with ${this.persona.name} · Awaiting agent opening greeting]`,
      };
    }
  }

  // Context-aware suggested response prompts for the agent based strictly on CURRENT stage
  getStagePrompts(): string[] {
    switch (this.currentStage) {
      case 'greeting':
        return [
          `Hello ${this.persona.name}! Arvind from The Sleep Company Koramangala. How can I assist you today?`,
          `Good afternoon ${this.persona.name}, calling regarding your inquiry on the ${this.persona.productInterest}.`,
        ];
      case 'discovery':
        return [
          'What sleeping posture or firmness level are you and your family looking for?',
          'Are you currently experiencing any back stiffness or sleep discomfort?',
        ];
      case 'pitch':
        return [
          'Our patented SmartGRID adapts to your body posture while air channels keep it 4° cooler.',
          'Unlike memory foam that traps body heat and sags, SmartGRID provides isolated orthopedic spine support.',
        ];
      case 'objection':
        return [
          'We provide an exclusive 10-year warranty plus a 100-night risk-free trial in your home.',
          'You can opt for our zero-downpayment 12-month zero-interest EMI on any major credit card.',
        ];
      case 'closing':
        return [
          `I can reserve a private firmness trial demo for you at our Koramangala store this Saturday.`,
          `May I send you the official quotation and store directions directly on WhatsApp?`,
        ];
      case 'completed':
        return [
          'Thank you for your time, looking forward to welcoming you at our Koramangala store!',
          'Have a wonderful afternoon!',
        ];
    }
  }

  // Process agent input and return intelligent, persona-grounded customer response
  processAgentSpeech(agentText: string, timeStr: string): { customerReply: string; sopFlag?: string } {
    const lower = agentText.toLowerCase();

    // 1. Evaluate Stage Progression & Out-of-Order Detection
    let customerReply = '';
    let sopFlag: string | undefined;

    // Check Greeting
    const isGreeting =
      lower.includes('hello') ||
      lower.includes('arvind') ||
      lower.includes('sleep company') ||
      lower.includes('good afternoon') ||
      lower.includes('calling regarding');

    // Check Discovery
    const isDiscovery =
      lower.includes('posture') ||
      lower.includes('firmness') ||
      lower.includes('stiffness') ||
      lower.includes('back') ||
      lower.includes('looking for') ||
      lower.includes('pain') ||
      lower.includes('discomfort');

    // Check Pitch
    const isPitch =
      lower.includes('smartgrid') ||
      lower.includes('ortho') ||
      lower.includes('luxe') ||
      lower.includes('foam') ||
      lower.includes('cooler') ||
      lower.includes('spine') ||
      lower.includes('patented');

    // Check Financing & Warranty
    const isFinance =
      lower.includes('emi') ||
      lower.includes('zero') ||
      lower.includes('interest') ||
      lower.includes('finance') ||
      lower.includes('month');

    const isWarranty =
      lower.includes('warranty') ||
      lower.includes('10-year') ||
      lower.includes('trial') ||
      lower.includes('100-night');

    // Check Closing
    const isClosing =
      lower.includes('whatsapp') ||
      lower.includes('visit') ||
      lower.includes('store') ||
      lower.includes('demo') ||
      lower.includes('reserve') ||
      lower.includes('quote') ||
      lower.includes('slot');

    // ── Turn Enforcement & Response Branching ──────────────────────

    if (this.currentStage === 'greeting') {
      if (isGreeting) {
        this.hasAgentGreeted = true;
        this.currentStage = 'discovery';
        this.sentimentScore = Math.min(98, this.sentimentScore + 6);
        customerReply = this.persona.outboundOpeningResponse;
        sopFlag = 'Opening & Intent Confirm';
      } else if (isClosing || isFinance) {
        // Agent tried to close sale or pitch price before greeting
        this.sentimentScore = Math.max(45, this.sentimentScore - 8);
        customerReply =
          "Wait, before we discuss prices, who am I speaking with and what company is this?";
      } else {
        customerReply =
          "Hello? Who is this and what is this call regarding?";
      }
    } else if (this.currentStage === 'discovery') {
      if (isDiscovery) {
        this.hasDiscoveredNeeds = true;
        this.currentStage = 'pitch';
        this.sentimentScore = Math.min(98, this.sentimentScore + 7);
        customerReply = this.persona.discoveryResponse;
        sopFlag = 'Needs & Firmness Discovery';
      } else if (isPitch) {
        // Agent jumped ahead to pitch without probing needs
        this.hasPitchedProduct = true;
        this.currentStage = 'objection';
        this.sentimentScore = Math.min(98, this.sentimentScore + 3);
        customerReply = this.persona.pitchReaction;
        sopFlag = 'SmartGRID Ergonomic Pitch';
      } else {
        customerReply =
          `I am looking for something comfortable for our bedroom. What options do you recommend?`;
      }
    } else if (this.currentStage === 'pitch') {
      if (isPitch || isDiscovery) {
        this.hasPitchedProduct = true;
        this.currentStage = 'objection';
        this.sentimentScore = Math.min(98, this.sentimentScore + 6);
        customerReply = this.persona.pitchReaction;
        sopFlag = 'SmartGRID Ergonomic Pitch';
      } else if (isFinance || isWarranty) {
        if (isFinance) this.hasAddressedFinance = true;
        if (isWarranty) this.hasAddressedWarranty = true;
        this.currentStage = 'closing';
        this.sentimentScore = Math.min(98, this.sentimentScore + 8);
        customerReply = this.persona.objectionResponse;
        sopFlag = isFinance ? '12-Month Zero-Cost EMI' : '10-Year Warranty & 100-Night Trial';
      } else {
        customerReply =
          'That sounds interesting. But how does it compare to standard memory foam, and does it sag?';
      }
    } else if (this.currentStage === 'objection') {
      if (isFinance || isWarranty) {
        if (isFinance) this.hasAddressedFinance = true;
        if (isWarranty) this.hasAddressedWarranty = true;
        this.currentStage = 'closing';
        this.sentimentScore = Math.min(98, this.sentimentScore + 8);
        customerReply = this.persona.objectionResponse;
        sopFlag = isFinance ? '12-Month Zero-Cost EMI' : '10-Year Warranty & 100-Night Trial';
      } else if (isClosing) {
        this.hasClosedGoal = true;
        this.currentStage = 'completed';
        this.sentimentScore = Math.min(98, this.sentimentScore + 5);
        customerReply = this.persona.closingAgreement;
        sopFlag = 'Closing / Showroom Visit Booking';
      } else {
        customerReply =
          'What financing or warranty coverage do you offer on this model?';
      }
    } else if (this.currentStage === 'closing' || this.currentStage === 'completed') {
      if (isClosing) {
        this.hasClosedGoal = true;
        this.currentStage = 'completed';
        this.sentimentScore = Math.min(98, this.sentimentScore + 8);
        customerReply = this.persona.closingAgreement;
        sopFlag = 'Closing / Showroom Visit Booking';
      } else if (isFinance) {
        this.hasAddressedFinance = true;
        customerReply = 'Understood. The zero-interest plan sounds very manageable.';
        sopFlag = '12-Month Zero-Cost EMI';
      } else if (isWarranty) {
        this.hasAddressedWarranty = true;
        customerReply = '10 years warranty is great peace of mind.';
        sopFlag = '10-Year Warranty & 100-Night Trial';
      } else {
        customerReply =
          `Thank you Arvind. Please send me the details on WhatsApp and I'll see you at the store!`;
      }
    }

    // Save agent turn
    this.turns.push({
      speaker: 'agent',
      name: 'Arvind Rajan (You)',
      text: agentText,
      time: timeStr,
      stage: this.currentStage,
      sopFlag,
    });

    return { customerReply, sopFlag };
  }

  // Get verbatim quotes from agent turns for each SOP criterion
  getEvidenceForCriterion(key: string): { passed: boolean; score: number; evidence: string } {
    const matchingTurn = this.turns.find((t) => {
      if (t.speaker !== 'agent') return false;
      const lower = t.text.toLowerCase();
      switch (key) {
        case 'opening':
          return lower.includes('hello') || lower.includes('arvind') || lower.includes('sleep company');
        case 'discovery':
          return lower.includes('posture') || lower.includes('firmness') || lower.includes('back') || lower.includes('stiffness');
        case 'pitch':
          return lower.includes('smartgrid') || lower.includes('ortho') || lower.includes('patented') || lower.includes('spine');
        case 'emi':
          return lower.includes('emi') || lower.includes('zero') || lower.includes('interest') || lower.includes('month');
        case 'warranty':
          return lower.includes('warranty') || lower.includes('10-year') || lower.includes('trial') || lower.includes('100-night');
        case 'closing':
          return lower.includes('whatsapp') || lower.includes('visit') || lower.includes('store') || lower.includes('demo') || lower.includes('reserve');
        default:
          return false;
      }
    });

    if (matchingTurn) {
      return {
        passed: true,
        score: 95,
        evidence: `"${matchingTurn.text}" (${matchingTurn.time})`,
      };
    }

    return {
      passed: false,
      score: 60,
      evidence: 'Criterion was not addressed in agent dialogue turns',
    };
  }

  calculateFinalSopScore(): number {
    const checks = this.getSopChecks();
    const passedCount = Object.values(checks).filter(Boolean).length;
    return Math.min(98, Math.max(60, passedCount * 16));
  }
}
