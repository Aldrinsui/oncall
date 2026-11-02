# On-Ground.ai Call Centre App

A production-grade, highly responsive web application built for retail tele-calling agents at **The Sleep Company (Koramangala Store)** for the **On-Ground.ai Engineering Hire Assignment (November 2026)**.

Repository: [github.com/Aldrinsui/oncall](https://github.com/Aldrinsui/oncall)  
Built with **React 18**, **TypeScript (Strict Mode)**, **Vite**, **Tailwind CSS 3.4**, **Recharts**, and browser-native **Web Audio**, **Web Speech**, and **WebRTC PeerConnection** APIs.

---

## 🚀 Live Demo & Deployment

- **Vercel Zero-Config Deployment**: The repository contains `vercel.json` configured for SPA routing.
- **Local Dev Server**:
  ```bash
  # 1. Clone the repository
  git clone https://github.com/Aldrinsui/oncall.git
  cd oncall

  # 2. Install dependencies
  npm install

  # 3. Start local development server
  npm run dev
  ```
  Open `http://localhost:5173` in Google Chrome (Chrome recommended for native Web Speech API support).

- **Production Build & Verification**:
  ```bash
  npx tsc -b
  npm run build
  npm run preview
  ```

---

## 📋 Compliance & Feature Status Matrix

| Assignment Requirement | Type | Status | Technical Details |
|---|---|---|---|
| **App Shell (Sidebar & Topbar)** | Mandatory | ✅ Complete | Fixed collapsible sidebar, Topbar with OG Score ring, active notifications, and mobile bottom drawer. |
| **Dashboard** | Mandatory | ✅ Complete | Shift KPIs (`14/18`), live queue with Call Now, earnings (`₹5,200`), 7-day interactive Recharts, and accessible task list. |
| **Plan — Calls to Make** | Mandatory | ✅ Complete | 6 leads sorted strictly descending by score (`90` to `65`), pagination (2/page), expandable pitch/EMI strategies, decoupled buttons. |
| **Plan — Incoming Calls** | Mandatory | ✅ Complete | 4 missed calls, dynamic aggregate value at stake (`₹77,390`), and working "Call Back" action on every row. |
| **Plan — Recent Calls** | Mandatory | ✅ Complete | Direction badges (↙, ↗, ✕), dynamic call logs, and interactive 6-pillar SOP review modal with transcript evidence quotes. |
| **Calendar** | Mandatory | ✅ Complete | Month grid with event dots strictly scoped to Nov 2026, month switcher, Today jump button, and working clipboard copy. |
| **Pulse Home & Channel Chat** | Mandatory | ✅ Complete | AvaniBot, 5 role agents, channel switching without stale state, secure text rendering (zero XSS), pinned input reply card. |
| **Leads Modal** | Mandatory | ✅ Complete | Dossier card with ICP Fit (`87%`) & Intent (`91%`), collapsible signals, next/prev pagination, and direct Call trigger. |
| **Working Calling Feature** | Mandatory | ✅ Complete | Web Audio API ringing synthesis, SpeechSynthesis voice, mic capture, live STT, hardware mute/hold, and WebRTC peer calling. |
| **Bonus: Channel Message Sending** | Bonus | ✅ Complete | Working message composer with instant thread updates and optimistic delivery. |
| **Bonus: "Needs Your Input" Response** | Bonus | ✅ Complete | Pinned card with "Confirmed ✓" and "Reschedule" actions posting directly into chat. |
| **Bonus: Phone-Width Mobile Support** | Bonus | ✅ Complete | Responsive layouts across all views with custom slide-up sheets and bottom navigation. |
| **Bonus: 7-Day Performance Charts** | Bonus | ✅ Complete | Interactive SVG charts with metric tabs and dynamic weekly totals. |
| **Bonus: Practise a Call** | Bonus | ✅ Complete | Interactive scenario cards launching simulated customer dialogue sessions. |

---

## 📞 Calling Architecture (How Calling Truly Works)

The assignment PDF mandates:
> *"Your product demo must include the CALLING FEATURE WORKING. Mock screens alone are not enough. Explain how you got calling working. Where possible, show human-to-human and AI-to-human calling."*

To satisfy this without fragile third-party telephony accounts (which fail in sandboxes or require paid PSTN credentials), we engineered a **two-path real audio system**:

```
                       ┌───────────────────────────────────────────┐
                       │           Active In-Call Screen           │
                       └─────────────────────┬─────────────────────┘
                                             │
               ┌─────────────────────────────┴─────────────────────────────┐
               ▼                                                           ▼
┌──────────────────────────────────────────┐               ┌──────────────────────────────────────────┐
│   Speech-Enabled Customer Roleplay       │               │      Human-to-Human WebRTC Intercom      │
├──────────────────────────────────────────┤               ├──────────────────────────────────────────┤
│ • Web Audio API (OscillatorNode)         │               │ • RTCPeerConnection (Google STUN)        │
│   440Hz + 480Hz dual-frequency ringing   │               │ • BroadcastChannel Zero-Server Signaling │
│ • Web SpeechSynthesis (TTS)              │               │ • Bidirectional microphone audio tracks  │
│   Real audible customer speech           │               │   between two browser tabs               │
│ • Web SpeechRecognition (STT)            │               │ • Incoming call offer popover            │
│   Dictates agent voice to live text      │               │ • Automatic `<audio>` element playback   │
│ • Dynamic Heuristic Dialogue Tree        │               │ • Hardware-level mic track muting        │
│ • Real-time sentiment scoring (50-98%)   │               └──────────────────────────────────────────┘
│ • Transcript-driven SOP evidence quotes  │
└──────────────────────────────────────────┘
```

### 1. Web Audio API Synthesis (`src/services/audioService.ts`)
- Zero external MP3 assets or network dependencies.
- Standard North American / Indian telephone ring cadence generated mathematically using dual oscillators (440Hz and 480Hz) modulated with a gain node at 2.0s on / 4.0s off intervals.
- Connect chime (523.25Hz -> 659.25Hz -> 783.99Hz) and disconnect tones.

### 2. Speech-Enabled Customer Roleplay Simulator
- **Voice Output**: Uses `window.speechSynthesis` with Indian English / natural voice fallback to speak customer objections and questions out loud.
- **Microphone Input & Analyser**: Captures live audio via `navigator.mediaDevices.getUserMedia`, pipeable to an `AnalyserNode` for the real-time bouncing green frequency visualizer canvas (`AudioVisualizer.tsx`).
- **Live Transcription**: `SpeechRecognition` transcribes the agent's live voice into streaming transcript blocks.
- **Heuristic Dialogue & Sentiment Engine**: Analyzes conversation turns for objection keywords (EMI, warranty, mattress types, showroom visits) and computes real-time sentiment scores (clamped 50% to 98%).
- **Hardware-Level Mute & Hold Controls**:
  - **Mute**: Directly sets `track.enabled = false` on the hardware audio stream and pauses STT.
  - **Hold**: Silences audio, pauses the call timer, and clears pending response timers.

### 3. Human-to-Human WebRTC Peer Calling (`src/services/webrtcService.ts`)
- Enables authentic two-way human audio communication across two browser tabs or windows without an external backend signaling server.
- Uses the browser's native `BroadcastChannel('onground-callcentre-peer')` for local signaling (SDP offer/answer exchange and ICE candidates).
- Automatically routes incoming audio tracks to an HTML `<audio autoplay />` element so both agents hear each other in real-time.
- Tab 1 clicks **"Start WebRTC Peer Call"** -> Tab 2 displays an incoming audio call banner -> Tab 2 clicks **"Accept Peer Audio"** -> Two-way WebRTC audio is active!

### 4. Post-Call Wrap-up & Dynamic SOP Evidence Extraction
- Maps all 5 outcomes correctly (`Interested`, `Follow-up`, `Requested callback`, `Resolved`, `Not interested`).
- Extracts verbatim quotes from the actual call transcript (e.g., quotes where the agent pitched EMI or warranty) to provide grounded evidence in the **Call SOP Review Modal**.
- Appends completed calls directly to the application state so the **Recent Calls** tab updates immediately.

---

## 🔒 Security & Code Quality

- **Pulse Chat XSS Prevention**: Eliminated `dangerouslySetInnerHTML`. Replaced with a safe `SafeMessageText` component that renders user input strictly as plain text while parsing safe system bold tags.
- **Channel State Synchronization**: Pulse message threads are indexed by `channelId` to prevent stale message display when switching between channels.
- **Calendar Event Scoping**: Event indicators are strictly scoped to November 2026.
- **Accessibility**: Resolved all nested interactive controls in `TasksList.tsx` and `CallsToMake.tsx`, ensuring independent tab stops and accessible `aria-expanded` attributes.

---

## 🤖 AI Tools Disclosure

In accordance with the assignment guidelines:
- **Google DeepMind Antigravity**: Used as the primary agentic pair programming environment powered by **Claude** and **Gemini** models for architecture exploration, rapid component development, and test verification.
- **Handcrafted Domain Logic**: All mock datasets, business logic (SOP grading, OG score formula, lead ranking, and Web Audio synthesizers), and styling were tailored directly to the OnGround.ai assignment requirements.

---

## 🎬 2-Minute Demo Walkthrough Script

1. **Dashboard & KPIs (0:00 – 0:30)**:
   - Review shift progress (`14/18` calls) and the OG Score (`76`).
   - Open the OG Score card to verify the 4-pillar breakdown (`78, 72, 74, 81 -> 76`).
   - Switch metrics on the 7-Day Performance Chart (Calls Made, Talk Time, Conversions).
   - Click task #1 to open the **Leads Modal** with Mukunda R. (`87% ICP`, `91% Intent`).
2. **Calling Engine & Voice Interaction (0:30 – 1:15)**:
   - Click **"Call Lead Now"** to trigger realistic telephone ringing synthesized via the Web Audio API.
   - Click **"Answer / Connect"**; listen to the customer voice speak aloud.
   - Click **"Enable Mic"** or select a quick prompt (e.g., *"We offer 12-month zero-interest EMI..."*).
   - Observe the live frequency visualizer bars bouncing, real-time transcript streaming, and the SOP checklist dynamically checking items off.
   - Test the **Mute** and **Hold** buttons (verifying hardware audio track pause).
   - Click **"End Call"** -> Tag outcome as **"Interested"** -> View the automated SOP review with verbatim transcript quotes.
   - Notice the completed call immediately appears in the **Recent Calls** tab!
3. **Plan Screen & Strict Ranking (1:15 – 1:35)**:
   - Navigate to **Plan** -> **Calls to Make**.
   - Verify all 6 leads are strictly ranked by score in descending order (`90 -> 88 -> 85 -> 78 -> 72 -> 65`).
   - Inspect **Incoming Calls** (dynamic `₹77,390` value at stake, "Call Back" button on each row).
4. **Calendar, Pulse & WebRTC (1:35 – 2:00)**:
   - **Calendar**: View November 2026 event dots, test the "Today" button, and copy an invite link.
   - **Pulse**: Open `#callcentre-team`, answer the pinned "Needs your input" card with **"Confirmed ✓"**, and post a reply in the chat.
   - **WebRTC Peer Calling**: Open a second tab, click **"Start WebRTC Peer Call"**, and accept on Tab 2 for multi-tab intercom audio!

---

*Developed for the On-Ground.ai Engineering Hiring Assessment.*
