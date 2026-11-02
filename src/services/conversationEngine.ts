// Deterministic Grounded Conversation Controller & Customer Persona State Machine
// Solves: Turn ordering, hallucinated product claims, duplicate responses, system speech leaks, and call completion.

export type ConversationState =
  | 'connected'
  | 'agent_listening'
  | 'processing'
  | 'customer_speaking'
  | 'agent_speaking'
  | 'closing'
  | 'completed'
  | 'error';

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
  painPoint: string;
  inboundOpening?: string;
  outboundGreetingResponse: string;
  discoveryResponse: string;
  pitchReaction: string; // The question customer asks after product pitch (e.g. warranty/guarantee)
  closingGoal: string;
}

export const CUSTOMER_PERSONAS: Record<string, CustomerPersona> = {
  // Suresh Nair — Lead 5 / Live Queue #2
  suresh: {
    id: 'suresh',
    name: 'Suresh Nair',
    initials: 'SN',
    phone: '+91 97654 32100',
    callDirection: 'outbound',
    productInterest: 'Ortho GRID Mattress (Queen)',
    painPoint: 'Severe lower back soreness from long sitting hours and waking up sweaty',
    outboundGreetingResponse:
      'Hello Arvind! Thanks for following up. Yes, I was looking into upgrading my mattress on your website.',
    discoveryResponse:
      'I have persistent lower back stiffness after working 9 hours at a desk, and my current foam mattress gets way too warm at night.',
    pitchReaction:
      'The patented grid posture alignment and airflow channels sound promising. What kind of guarantee and trial period do you provide?',
    closingGoal: 'Saturday 4:00 PM trial demo at Koramangala store + WhatsApp quote',
  },

  // Mukunda R. — Outbound High Propensity Lead (Ortho GRID)
  mukunda: {
    id: 'mukunda',
    name: 'Mukunda R.',
    initials: 'MR',
    phone: '+91 98450 12345',
    callDirection: 'outbound',
    productInterest: 'Ortho GRID Mattress (Queen)',
    painPoint: 'Lumbar spine discomfort and doubts about grid durability',
    outboundGreetingResponse:
      'Hello Arvind! Thanks for following up. Yes, I checked out your Ortho GRID mattress online yesterday.',
    discoveryResponse:
      'I spend long hours sitting at a laptop and wake up with stiffness in my lower lumbar. My current mattress feels hot and saggy.',
    pitchReaction:
      'SmartGRID posture alignment sounds great. But what kind of warranty and risk-free trial do you offer against sagging?',
    closingGoal: 'Saturday 4:00 PM private demo at Koramangala store + WhatsApp quote',
  },

  // Priya Iyer — Inbound Missed / Billing Dispute
  priya: {
    id: 'priya',
    name: 'Priya Iyer',
    initials: 'PI',
    phone: '+91 98450 67890',
    callDirection: 'inbound',
    productInterest: 'SmartGRID Luxe & EMI Statement',
    painPoint: 'Disputed ₹1,200 handling fee on recent EMI invoice',
    inboundOpening:
      "Hello, is this The Sleep Company? I've called twice about an unexpected ₹1,200 charge on my EMI statement.",
    outboundGreetingResponse:
      "Hello, yes! I'm glad you called back. I've been trying to get an answer about an extra ₹1,200 charge on my invoice.",
    discoveryResponse:
      'My invoice shows an additional ₹1,200 processing fee that was supposed to be waived under the zero-interest offer.',
    pitchReaction:
      'Thank you for looking into the invoice so quickly. Can you confirm the exact fee reversal timeline?',
    closingGoal: 'Fee waiver confirmation within 2 hours + credit receipt on WhatsApp',
  },

  // Rohan P. — Outbound Luxe Inquirer
  rohan: {
    id: 'rohan',
    name: 'Rohan P.',
    initials: 'RP',
    phone: '+91 98450 23456',
    callDirection: 'outbound',
    productInterest: 'SmartGRID Luxe (King)',
    painPoint: 'Disturbed sleep from partner movement and heat trapped by memory foam',
    outboundGreetingResponse:
      'Hi Arvind! Yes, I was browsing your SmartGRID Luxe King mattress for our new master bedroom.',
    discoveryResponse:
      'My wife is a light sleeper, so zero motion isolation and temperature control are our top priorities.',
    pitchReaction:
      'Zero motion transfer sounds ideal. What warranty and home trial do you provide on this luxury model?',
    closingGoal: 'VIP Store trial booking with ASM Ravi Kumar this Saturday at 2 PM',
  },

  // Fallback Persona
  generic: {
    id: 'generic',
    name: 'Customer',
    initials: 'CU',
    phone: '+91 98450 00000',
    callDirection: 'outbound',
    productInterest: 'SmartGRID Orthopedic Mattress',
    painPoint: 'Looking for ergonomic spine support and cooler sleep',
    outboundGreetingResponse:
      'Hello Arvind! Thanks for calling. I was indeed inquiring about your ergonomic mattresses.',
    discoveryResponse:
      'I need good lower back support and something that stays cool during humid nights.',
    pitchReaction:
      'The patented grid design makes sense. What kind of guarantee and trial period do you provide?',
    closingGoal: 'Showroom test visit + official price quote on WhatsApp',
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
  private state: ConversationState = 'connected';
  private currentStage: ConversationStage = 'greeting';
  private turns: ConversationTurn[] = [];
  private sentimentScore: number = 78;
  private isOutbound: boolean = true;

  // Turn Tracking & Pending Question Grounding
  private pendingQuestion: 'none' | 'warranty_trial' | 'financing' | 'closing' = 'none';
  private hasAgentGreeted = false;
  private hasDiscoveredNeeds = false;
  private hasPitchedProduct = false;
  private hasAddressedWarranty = false;
  private hasAddressedFinance = false;
  private hasAgreedToClosing = false;
  private hasCompletedSignoff = false;

  constructor(targetMeta?: { id?: string; name?: string; intent?: string } | null) {
    this.persona = this.resolvePersona(targetMeta);
    this.isOutbound =
      !targetMeta?.intent?.toLowerCase().includes('missed') &&
      !targetMeta?.intent?.toLowerCase().includes('dispute') &&
      !targetMeta?.intent?.toLowerCase().includes('inbound');

    this.state = 'connected';
    this.currentStage = 'greeting';
    this.sentimentScore = this.persona.id === 'priya' ? 58 : 78;
  }

  private resolvePersona(meta?: { id?: string; name?: string; intent?: string } | null): CustomerPersona {
    if (!meta) return CUSTOMER_PERSONAS.generic;
    const name = (meta.name || '').toLowerCase();
    const id = (meta.id || '').toLowerCase();
    if (name.includes('suresh') || id === 'q2' || id === 'l5') return CUSTOMER_PERSONAS.suresh;
    if (name.includes('mukunda') || id === 'l1' || id === 'lead_1') return CUSTOMER_PERSONAS.mukunda;
    if (name.includes('priya') || id === 'ic1' || id === 'q1') return CUSTOMER_PERSONAS.priya;
    if (name.includes('rohan') || id === 'l2' || id === 'lead_2') return CUSTOMER_PERSONAS.rohan;
    return CUSTOMER_PERSONAS[id] || CUSTOMER_PERSONAS.generic;
  }

  getPersona(): CustomerPersona {
    return this.persona;
  }

  getState(): ConversationState {
    return this.state;
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
      warranty: this.hasAddressedWarranty,
      emi: this.hasAddressedFinance,
      closing: this.hasCompletedSignoff || this.hasAgreedToClosing,
    };
  }

  // Initial call opening line: Outbound has NO customer speech leak!
  getOpeningLine(): { hasSpeech: boolean; text: string } {
    if (!this.isOutbound && this.persona.inboundOpening) {
      // Inbound: Customer speaks their inquiry
      this.state = 'agent_listening';
      return {
        hasSpeech: true,
        text: this.persona.inboundOpening,
      };
    }
    // Outbound: System is connected, customer says nothing until agent introduces self
    this.state = 'agent_listening';
    return {
      hasSpeech: false,
      text: '',
    };
  }

  // Dynamic context-aware stage prompts for the agent
  getStagePrompts(): string[] {
    switch (this.currentStage) {
      case 'greeting':
        return [
          `Hello ${this.persona.name}! Arvind from The Sleep Company Koramangala. How can I assist you today?`,
          `Good afternoon ${this.persona.name}, calling regarding your inquiry on the ${this.persona.productInterest}.`,
        ];
      case 'discovery':
        return [
          'What sleeping posture or firmness level are you looking for?',
          'Are you currently experiencing any lower back stiffness or sleeping discomfort?',
        ];
      case 'pitch':
        return [
          'Our patented SmartGRID adapts to your body posture while 2500+ air channels keep it 4° cooler.',
          'Unlike memory foam that sags and traps heat, SmartGRID provides active orthopedic spine support.',
        ];
      case 'objection':
        if (this.pendingQuestion === 'warranty_trial' || !this.hasAddressedWarranty) {
          return [
            'It comes with an exclusive 10-year warranty and a 100-night risk-free trial in your home.',
            'We guarantee zero sagging with a full 10-year warranty plus 100 nights home trial.',
          ];
        }
        return [
          'You can opt for our zero-downpayment 12-month zero-interest EMI on any major credit card.',
          'We have an exclusive zero-interest EMI starting at just ₹2,800/month with zero processing fee.',
        ];
      case 'closing':
        if (this.hasAgreedToClosing) {
          return [
            'Thank you, looking forward to meeting you at our Koramangala store this Saturday! Have a great day!',
            'All set! I will send the WhatsApp confirmation right away. Have a wonderful weekend!',
          ];
        }
        return [
          `May I reserve a private demo for you at our Koramangala store this Saturday and send the quote on WhatsApp?`,
          `I can send you the official price breakdown and store directions on WhatsApp right now.`,
        ];
      case 'completed':
        return ['Call completed.'];
    }
  }

  // Process agent speech and generate strictly grounded, non-hallucinated response
  processAgentSpeech(
    agentText: string,
    timeStr: string
  ): { customerReply: string; sopFlag?: string; callCompleted?: boolean } {
    if (this.state === 'completed') {
      return { customerReply: '', callCompleted: true };
    }

    const lower = agentText.toLowerCase();

    // Utterance intent classification
    const isGreeting =
      lower.includes('hello') ||
      lower.includes('arvind') ||
      lower.includes('sleep company') ||
      lower.includes('good afternoon') ||
      lower.includes('calling regarding');

    const isDiscovery =
      lower.includes('posture') ||
      lower.includes('firmness') ||
      lower.includes('stiffness') ||
      lower.includes('back') ||
      lower.includes('looking for') ||
      lower.includes('discomfort') ||
      lower.includes('sleeping');

    const isPitch =
      lower.includes('smartgrid') ||
      lower.includes('ortho') ||
      lower.includes('luxe') ||
      lower.includes('foam') ||
      lower.includes('cooler') ||
      lower.includes('spine') ||
      lower.includes('patented') ||
      lower.includes('air channels');

    const isWarranty =
      lower.includes('warranty') ||
      lower.includes('10-year') ||
      lower.includes('trial') ||
      lower.includes('100-night') ||
      lower.includes('guarantee');

    const isFinance =
      lower.includes('emi') ||
      lower.includes('zero') ||
      lower.includes('interest') ||
      lower.includes('finance') ||
      lower.includes('credit card') ||
      lower.includes('month');

    const isClosing =
      lower.includes('whatsapp') ||
      lower.includes('visit') ||
      lower.includes('store') ||
      lower.includes('demo') ||
      lower.includes('reserve') ||
      lower.includes('quote') ||
      lower.includes('saturday');

    const isSignoff =
      lower.includes('thank you') ||
      lower.includes('great day') ||
      lower.includes('wonderful') ||
      lower.includes('looking forward') ||
      lower.includes('all set') ||
      lower.includes('bye');

    let customerReply = '';
    let sopFlag: string | undefined;

    // ─── Stage 1: Greeting ──────────────────────────────────────────
    if (this.currentStage === 'greeting') {
      if (isGreeting) {
        this.hasAgentGreeted = true;
        this.currentStage = 'discovery';
        this.sentimentScore = Math.min(98, this.sentimentScore + 6);
        customerReply = this.persona.outboundGreetingResponse;
        sopFlag = 'Opening & Intent Confirm';
      } else if (isFinance || isClosing) {
        this.sentimentScore = Math.max(45, this.sentimentScore - 8);
        customerReply = 'Wait, before discussing prices or visits, who is this and what company are you calling from?';
      } else {
        customerReply = 'Hello? Who is this and what is this call regarding?';
      }
    }

    // ─── Stage 2: Needs Discovery ───────────────────────────────────
    else if (this.currentStage === 'discovery') {
      if (isDiscovery) {
        this.hasDiscoveredNeeds = true;
        this.currentStage = 'pitch';
        this.sentimentScore = Math.min(98, this.sentimentScore + 7);
        customerReply = this.persona.discoveryResponse;
        sopFlag = 'Needs & Firmness Discovery';
      } else if (isPitch) {
        this.hasPitchedProduct = true;
        this.currentStage = 'objection';
        this.pendingQuestion = 'warranty_trial';
        this.sentimentScore = Math.min(98, this.sentimentScore + 4);
        customerReply = this.persona.pitchReaction;
        sopFlag = 'SmartGRID Ergonomic Pitch';
      } else {
        customerReply = 'I am looking for good spine support because I wake up with stiffness. What do you recommend?';
      }
    }

    // ─── Stage 3: Product Pitch ─────────────────────────────────────
    else if (this.currentStage === 'pitch') {
      if (isPitch || isDiscovery) {
        this.hasPitchedProduct = true;
        this.currentStage = 'objection';
        this.pendingQuestion = 'warranty_trial';
        this.sentimentScore = Math.min(98, this.sentimentScore + 6);
        customerReply = this.persona.pitchReaction;
        sopFlag = 'SmartGRID Ergonomic Pitch';
      } else if (isWarranty) {
        this.hasAddressedWarranty = true;
        this.currentStage = 'objection';
        this.pendingQuestion = 'financing';
        this.sentimentScore = Math.min(98, this.sentimentScore + 8);
        customerReply = '10 years warranty with 100 nights trial gives me peace of mind! What are the pricing and zero-interest EMI financing terms?';
        sopFlag = '10-Year Warranty & 100-Night Trial';
      } else {
        customerReply = 'That sounds interesting. But how does it compare to regular memory foam, and does it sag over time?';
      }
    }

    // ─── Stage 4: Objection Handling (Strict Grounding) ─────────────
    else if (this.currentStage === 'objection') {
      // CASE A: Customer asked about Warranty & Trial, but Agent only answered EMI
      if (this.pendingQuestion === 'warranty_trial' && isFinance && !isWarranty) {
        this.hasAddressedFinance = true;
        this.sentimentScore = Math.max(50, this.sentimentScore - 2);
        customerReply =
          'The zero-interest EMI sounds affordable, but you did not mention the guarantee. How many years warranty and home trial do you provide?';
        sopFlag = '12-Month Zero-Cost EMI';
      }
      // CASE B: Agent answered Warranty
      else if (isWarranty) {
        this.hasAddressedWarranty = true;
        this.sentimentScore = Math.min(98, this.sentimentScore + 8);
        sopFlag = '10-Year Warranty & 100-Night Trial';

        if (isFinance || this.hasAddressedFinance) {
          this.hasAddressedFinance = true;
          this.currentStage = 'closing';
          this.pendingQuestion = 'closing';
          sopFlag = '10-Year Warranty & 12-Month EMI Financing';
          customerReply =
            'A 10-year warranty with 100 nights trial is very reassuring! And zero-downpayment on 12 months EMI fits my monthly budget.';
        } else {
          this.pendingQuestion = 'financing';
          customerReply =
            '10 years warranty with 100 nights risk-free trial is fantastic! Could you also explain how your zero-interest EMI financing works?';
        }
      }
      // CASE C: Agent answered Financing after warranty was addressed
      else if (isFinance) {
        this.hasAddressedFinance = true;
        this.currentStage = 'closing';
        this.pendingQuestion = 'closing';
        this.sentimentScore = Math.min(98, this.sentimentScore + 7);
        customerReply =
          'Zero-downpayment on 12 months EMI sounds very manageable. Can you send the quotation on WhatsApp and arrange a store demo?';
        sopFlag = '12-Month Zero-Cost EMI';
      }
      // CASE D: Agent jumped to closing
      else if (isClosing) {
        customerReply = 'Before booking a visit, what warranty guarantee and financing terms do you offer?';
      } else {
        customerReply = 'What warranty guarantee and trial period do you provide on this mattress?';
      }
    }

    // ─── Stage 5: Closing & Completion ──────────────────────────────
    else if (this.currentStage === 'closing') {
      if (!this.hasAgreedToClosing) {
        if (isClosing) {
          this.hasAgreedToClosing = true;
          this.sentimentScore = Math.min(98, this.sentimentScore + 8);
          customerReply =
            'Wonderful, Arvind! Please send me the official quote on WhatsApp and book me a demo slot this Saturday at 4:00 PM at Koramangala.';
          sopFlag = 'Closing / Showroom Visit Booking';
        } else {
          customerReply =
            'Can you send me the quote on WhatsApp and reserve a private trial slot for me this Saturday?';
        }
      } else {
        // Closing already confirmed. Agent says signoff or courtesy
        if (isSignoff || isClosing || isGreeting) {
          this.hasCompletedSignoff = true;
          this.currentStage = 'completed';
          this.state = 'completed';
          customerReply = 'Thank you Arvind, looking forward to meeting you this Saturday at Koramangala. Have a great day! Bye.';
          return { customerReply, sopFlag: 'Closing / Showroom Visit Booking', callCompleted: true };
        } else {
          customerReply = 'All set, Arvind! See you at the store this weekend. Bye!';
          this.hasCompletedSignoff = true;
          this.currentStage = 'completed';
          this.state = 'completed';
          return { customerReply, sopFlag: 'Closing / Showroom Visit Booking', callCompleted: true };
        }
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

  // Verbatim quotes from agent turns for each SOP criterion
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
          return lower.includes('smartgrid') || lower.includes('ortho') || lower.includes('patented') || lower.includes('cooler');
        case 'warranty':
          return lower.includes('warranty') || lower.includes('10-year') || lower.includes('trial') || lower.includes('100-night');
        case 'emi':
          return lower.includes('emi') || lower.includes('zero') || lower.includes('interest') || lower.includes('month');
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
      score: 55,
      evidence: 'Criterion was not addressed in agent dialogue turns',
    };
  }

  calculateFinalSopScore(): number {
    const checks = this.getSopChecks();
    const passedCount = Object.values(checks).filter(Boolean).length;
    return Math.min(98, Math.max(55, passedCount * 16));
  }
}
