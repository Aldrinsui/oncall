# On-Ground.ai Call Centre App

A complete, production-grade rebuild of the On-Ground.ai Call Centre application designed for retail tele-calling agents at **The Sleep Company (Koramangala Store)**.

Built from the ground up with **React 18**, **TypeScript**, **Vite**, **Tailwind CSS**, and modern web browser APIs (**Web Audio API**, **Web Speech API**, **WebRTC PeerConnection**, and **Recharts**).

---

## 🚀 Live Demo & How to Run

### Quick Start
```bash
# 1. Clone the repository
git clone https://github.com/Aldrinsui/oncall.git
cd oncall

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit `http://localhost:5173` in any modern browser (e.g., Google Chrome on macOS / Windows / Linux).

---

## 📞 How Calling Works (The Core Calling Engine)

The PDF requirement states:  
> *"Your product demo must include the CALLING FEATURE WORKING. Mock screens alone are not enough. Explain how you got calling working. Where possible, show human-to-human and AI-to-human calling."*

### 1. Dual-Engine Architecture
We implemented a complete, multi-modal calling subsystem that supports both **AI-to-Human Voice Roleplay** and **Human-to-Human WebRTC Calling**:

```
                       ┌───────────────────────────────────────────┐
                       │           Active In-Call Screen           │
                       └─────────────────────┬─────────────────────┘
                                             │
               ┌─────────────────────────────┴─────────────────────────────┐
               ▼                                                           ▼
┌─────────────────────────────┐                             ┌─────────────────────────────┐
│  AI-to-Human Roleplay Engine │                             │ Human-to-Human Peer Engine  │
├─────────────────────────────┤                             ├─────────────────────────────┤
│ • Web Audio API Synthesizer │                             │ • WebRTC RTCPeerConnection  │
│   (Ring cadence, DTMF keys, │                             │ • BroadcastChannel Signal   │
│   connect/disconnect chimes)│                             │ • Bidirectional microphone  │
│ • SpeechSynthesis TTS Voice │                             │   audio between two tabs    │
│   (Customer speaks out loud)│                             │ • Local Loopback Diagnostic │
│ • Web Speech STT Recognition│                             └─────────────────────────────┘
│   (Agent speaks into mic)   │
│ • AnalyserNode Waveform     │
│   (Real-time frequency bars)│
└─────────────────────────────┘
```

### 2. Audio & Speech Implementation Details
- **Zero External Audio Assets**:  
  All telephone ringing cadences (440Hz + 480Hz dual-frequency US/Indian tone), DTMF keypad sounds, connect chimes, and hangup tones are generated mathematically in real time via the browser's native `AudioContext` and `OscillatorNode` (`src/services/audioService.ts`). There are no missing MP3s or network lag.
- **AI Speech Synthesis (`speechService.ts`)**:  
  When an outbound call connects, the AI customer persona answers out loud via `window.speechSynthesis`, dynamically adjusting to objections, EMI queries, and warranty questions.
- **Real-Time Microphone Visualizer & Speech-to-Text**:  
  When the agent clicks **"Enable Mic"**, `navigator.mediaDevices.getUserMedia` connects the user's physical microphone to an `AnalyserNode` (`AudioVisualizer.tsx`) rendering real-time frequency waveforms. Simultaneously, `SpeechRecognition` transcribes spoken words into the live transcript.
- **Dynamic SOP Engine**:  
  As the conversation progresses, the AI Assist panel automatically evaluates the transcript and checks off SOP compliance items (Opening greeting, Needs discovery, Ergonomic pitch, 12-month EMI, 10-year warranty, Demo booking).
- **Post-Call Wrap-up & Automated SOP Audit**:  
  Clicking **End Call** transitions to the **Call Wrap-up Sheet** (`CallWrapupModal.tsx`) to log customer commitment, which immediately routes to the 6-pillar **Call SOP Review Modal** (`CallSopReviewModal.tsx`) showing pass/fail grades and transcript evidence quotes.

---

## 🖥️ Screen-by-Screen Overview

### 1. App Shell (`src/components/shell/`)
- **Fixed Sidebar**: 224px dark forest green gradient (`#123c30` to `#0d2e26`) with icon chips, active states, collapsible desktop mode (`md:pl-14` toggle), and an expandable **Plan** sub-menu accordion.
- **Topbar**: OG brand logo, live notification bell with unread action badges, keyboard-accessible **OG Score™** progress ring (`76`) + store standing pill (`⭐#3 Koramangala`), and an interactive agent profile avatar menu.
- **Mobile Navigation (`MobileNav.tsx`)**: Bottom navigation bar automatically displayed on viewports `< 768px`, complete with a dedicated slide-up **Plan Sub-Navigation Sheet** with full Escape key support.
- **Modals & Drawers**:
  - `NotificationsDrawer.tsx`: Slide-out activity feed with typed routing actions (`OPEN_PULSE_CHANNEL`, `OPEN_INCOMING_CALLS`, `OPEN_COACH`).
  - `SettingsModal.tsx`: Controlled switch for incoming call alerts, audio output selection, and store schedule.
  - `AvatarModal.tsx`: Agent profile card with score verification and performance tier.

### 2. Dashboard (`src/components/dashboard/`)
- **Shift Greeting Header**: *"Good afternoon 👋 Arvind Rajan · Koramangala"*, shift hours (`10:00 AM – 7:00 PM`), and store rank `#3 of 14`.
- **Calling Plan Target**: Scheduled `18` calls, `4m 22s` average duration, `84%` conversion target.
- **My Shift Progress**: `14/18` calls completed (`78%` animated progress bar).
- **OG Score™ Card**: Score `76` with circular conic-gradient ring. Clicking opens the **OG Score Breakdown Modal** (`OgScoreModal.tsx`) with 4 mathematically consistent pillars: SOP Adherence (`78`), Objection Handling (`72`), Conversion (`74`), and Sentiment (`81`).
- **Who is Waiting Now (`LiveQueue.tsx`)**: Real-time inbound waiting queue (Priya Iyer, Suresh Nair) with wait duration badges, intent tags, and 1-click **Call Now** buttons that launch the calling engine.
- **Earnings & Incentives (`EarningsCard.tsx`)**: `₹5,200` monthly total with breakdown of Base Calls Incentive (`₹3,400`) vs. Conversion Bonuses (`₹1,800`) and next-tier progress bar.
- **My Shift Tasks (`TasksList.tsx`)**: Interactive task checklist. Clicking lead-related tasks directly launches the **Leads Modal** focused on that specific lead record.
- **7-Day Performance Charts (`Charts7Day.tsx`)**: Interactive Recharts visualization with metric toggles for **Calls Made**, **Talk Time**, and **Closed Sales** with dynamically calculated totals (`134 calls`, `72.6m avg talk time`, `37 closed`).

### 3. Plan Screen (`src/components/plan/`)
- **Hero Banner**: Gradient header with date pill (`Tuesday, 3 Nov 2026`).
- **Sub-Tab Navigation**:
  1. **Calls to Make (`CallsToMake.tsx`)**:
     - Ranked strictly by score in descending order (`Mukunda R. 90`, `Rohan P. 88`, `Ritu S. 85`, `Kavita M. 78`, `Suresh N. 72`, `Deepa K. 65`).
     - Pagination: `Page 1 of 3` with Previous/Next navigation.
     - Expandable rows detailing recommended pitch strategies, zero-cost EMI options, cross-sell bundles, and buying signals.
     - Actions: *"Start Outbound Call"* and *"Open Full Lead Dossier"*.
  2. **Incoming Calls (`IncomingCalls.tsx`)**:
     - Missed inbound calls queue with value at stake (**`₹77,390` total**).
     - Frequency badges (*"2nd Missed Call"*, *"3rd Missed Call"*).
     - **"Call Back" button on every single row**.
  3. **Recent Calls (`RecentCalls.tsx`)**:
     - Complete call logs with call direction icons (Inbound ↙, Outbound ↗, Missed ✕), durations, timestamps, and outcome badges.
     - Clicking any row opens the **Call SOP Review Modal** (`CallSopReviewModal.tsx`) with 6-pillar evaluation and transcript quotes.
  4. **Practise a Call Launcher**:
     - Scenario launcher with customer personas (Ortho GRID, SmartGRID Luxe, etc.) for interactive AI voice roleplay.

### 4. Calendar (`src/components/calendar/`)
- Month grid (November 2026) with weekday headers, event indicator dots, and today highlight.
- Previous/Next month switcher with a 1-click **"Today"** jump button.
- Selected Day Agenda displaying scheduled coaching sessions, team huddles, and customer demos.
- **Share Invite Modal** with meeting link generator and 1-click clipboard copy.

### 5. Pulse Home & Channel Chat (`src/components/pulse/`)
- **AvaniBot Hero Banner**: AI manager assistant with quick-access team routing.
- **5 Specialized Shift Agents**:
  1. *Walk-out Recovery Agent* (`#0f6e56`)
  2. *Pitch Coach Agent* (`#854f0b`)
  3. *ASM Agent* (`#1a1a2e`)
  4. *Tele-caller Agent* (`#4a154b`)
  5. *Follow-up Agent* (`#185fa5`)
- **Active Channels List**: `#callcentre-team`, `#customer-discussions`, `#store-updates`, `#escalations` with unread counts.
- **Team Kudos Feed**: Shift shoutouts with peer reaction counters.
- **Channel Chat View (`PulseChannel.tsx`)**:
  - Pinned **"Needs your input"** card: *"Confirm 4:30 PM Friday coaching slot with Sunita?"* with interactive **"Confirmed ✓"** and **"Reschedule"** buttons + reply text input.
  - Real-time message streaming with left/right speaker bubbles and timestamps.
  - Interactive reply bar: type a message and press Enter or Send to post immediately.

### 6. Leads Modal (`src/components/modals/LeadsModal.tsx`)
- Detailed lead dossier displaying avatar, phone, expected value, and status badges.
- Dual visual meters for **ICP Fit Score** (`87%`) and **Lead Intent Score** (`91%`).
- Collapsible **"Where We Picked Up Signals"** accordion (Financing, Quotation, Warranty).
- Next/Previous lead pagination with keyboard Arrow Left / Right navigation.
- Direct **"Call Lead Now"** button.

---

## 🛠️ Technology Stack & Rationale

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | **React 18 + Vite** | Blazing-fast development and optimized production bundling. |
| **Language** | **TypeScript (Strict Mode)** | End-to-end type safety across all domain models, call states, and events. |
| **Styling** | **Tailwind CSS 3.4** | Clean design-token system matching On-Ground dark green palette. |
| **Audio Synthesis** | **Web Audio API** | 100% reliable hardware-level synthesis for phone ringing tones & DTMF keys without external audio files. |
| **Voice & Speech** | **Web Speech API** | Native `SpeechSynthesis` for customer voice + `SpeechRecognition` for live agent microphone transcription. |
| **Peer Calling** | **WebRTC + BroadcastChannel** | Multi-tab bidirectional real-time audio calling between agents without external server setup. |
| **Charts** | **Recharts** | Responsive SVG charts for 7-day performance analytics. |
| **Icons** | **Lucide React** | Consistent, modern vector iconography. |

---

## 🤖 AI Tools Disclosure
In compliance with the assignment ground rules:
- **Claude / Gemini via Antigravity pair programming**: Used for architectural ideation, component scaffolding, and refactoring.
- **Handcrafted implementation**: All UI layouts, state machines, Web Audio synthesizers, and WebRTC signaling pipelines were written and verified specifically for this project.

---

## 🎬 2-Minute Demo Script

1. **Dashboard Overview (0:00 – 0:30)**:
   - Check the KPI progress bar (`14/18` calls).
   - Click the **OG Score (76)** card to inspect the 4-pillar breakdown modal.
   - Toggle metrics on the **7-Day Performance Chart** (Calls, Talk Time, Conversions).
   - Click task #1 to open the **Leads Modal** with Mukunda R.
2. **Calling Engine Demo (0:30 – 1:15)**:
   - Click **"Call Lead Now"** in the Leads Modal or click **"Call Now"** in the Live Queue.
   - Listen to the realistic telephone ringing tone synthesized via the Web Audio API.
   - Click **"Answer / Connect"** to join the live call.
   - Notice the AI customer speaking aloud via SpeechSynthesis.
   - Click **"Enable Mic"** or click one of the quick SOP prompts (e.g. *"We offer a 12-month zero-interest EMI..."*).
   - Observe the live frequency visualizer bars bouncing, real-time transcript streaming, and the SOP checklist auto-checking items!
   - Click **"End Call"** -> Tag outcome as **"Interested"** -> Click **"Save & View SOP Score"** to review the quality audit.
3. **Plan Screen & Sorting (1:15 – 1:35)**:
   - Switch to **Plan**.
   - Notice all 6 leads are sorted in strict score-descending order (`90 -> 88 -> 85 -> 78 -> 72 -> 65`).
   - Click **Incoming** to see missed calls with value at stake and Call Back buttons.
   - Click **Recent** and tap any call to review its historical SOP audit.
4. **Calendar & Pulse (1:35 – 2:00)**:
   - Switch to **Calendar**: Click through dates with event dots, click **"Today"**, and click **"Share"** to copy an invite link.
   - Switch to **Pulse**: View the 5 role agents, open `#callcentre-team`, answer the pinned **"Needs your input"** card with **"Confirmed ✓"**, and send a reply message in the chat thread.

---
*Developed for the On-Ground.ai Engineering Hiring Assessment — November 2026.*
