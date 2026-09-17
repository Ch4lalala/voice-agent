# AksesSuara

> Making essential digital services accessible through guided conversation.

AksesSuara is an independent English-language hackathon prototype showing how a screen-aware voice guide can help older adults and people with low digital confidence move through a simulated public-service enrollment workflow. It is not affiliated with, endorsed by, or officially integrated with BPJS Kesehatan.

## Target users

AksesSuara is designed as a demonstration for older adults, people with low digital confidence, and anyone who benefits from short spoken guidance while completing an unfamiliar digital form. It remains fully usable without voice.

## What the MVP demonstrates

- A complete six-screen simulated enrollment journey that also works without voice.
- Deterministic, in-memory validation, sensitive-field masking, and explicit facility confirmation.
- A real AssemblyAI Voice Agent session started only after an explicit user action.
- A guided start that finishes the real greeting on Welcome, then moves exactly once to Requirements after its sanitized context is acknowledged.
- Sanitized current-screen context that excludes raw form values.
- Eight allowlisted client-side tools for explanation, focus, validation, one-step navigation, repetition, speech-style preference, and Review.
- Accessible live status, final agent captions, error recovery, keyboard operation, and responsive layouts.

The React enrollment state machine is authoritative. The agent can request an allowlisted action, but application code validates the tool name, arguments, active screen, field identifier, context version, and current workflow state before anything happens.

## Technology

- Next.js 16 App Router
- React 19 and strict TypeScript
- Tailwind CSS 4 plus project-owned CSS tokens
- AssemblyAI Voice Agent WebSocket API
- Vitest for unit and component coverage
- Playwright and axe-core for critical browser and accessibility coverage

## Architecture and data flow

```text
Typed demo data → React reducer → deterministic validation and masking
                                      ↓
                         sanitized screen context
                                      ↓
Explicit Start → server-only temporary token → AssemblyAI Voice Agent greeting
                                      ↓
                         deterministic Requirements transition
                                      ↓
                     acknowledged Requirements screen context
                                      ↓
                         allowlisted client tool request
                                      ↓
                     strict validator → reducer or focus effect
```

`POST /api/voice/token` reads `ASSEMBLYAI_API_KEY` only on the server and returns only a short-lived client token. Browser microphone audio is sent to AssemblyAI during an active real voice session. Audio, captions, transcripts, tokens, and form values are not persisted by this application.

## Local setup

Requirements:

- Node.js 22 or a compatible current Node.js release
- npm
- A modern Chromium-compatible browser with microphone permission for live voice testing
- An AssemblyAI API key for real voice guidance

Install and run:

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create `.env.local` locally using empty variable names as the template, then set the server-only key in your own environment:

```env
ASSEMBLYAI_API_KEY=
ASSEMBLYAI_AGENT_ID=
NEXT_PUBLIC_DEMO_MODE=false
```

`ASSEMBLYAI_AGENT_ID` is not used by the current inline session configuration. Never prefix an AssemblyAI credential with `NEXT_PUBLIC_`, commit `.env.local`, or expose a temporary token or WebSocket URL during a presentation.

## Verification commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run check
npm audit --omit=dev
```

Install the Playwright browser once if it is not already available:

```bash
npx playwright install chromium
```

The automated browser suite uses no real AssemblyAI credential and does not claim to test a paid voice session.

For a live guided start, choose **Start Voice Guidance** on Welcome and allow microphone access. The app applies the verified Welcome context, plays the real greeting completely, moves to Requirements once, focuses its heading, waits for the Requirements context acknowledgement, and then resumes Listening. Starting or retrying voice from another screen never changes the current enrollment step. **Continue Without Voice** remains the direct manual path to Requirements.

## Approved dummy demo data

Use only fictional information:

| Field | Demo value |
|---|---|
| Family Card Number | `3273000000003210` |
| Relationship | `Self` |
| Full Name | `Budi Santoso` |
| Date of Birth | `1959-04-12` |
| Phone Number | `081200000123` |
| Healthcare facility | `Taman Sari Community Clinic` (fictional) |

Do not enter real personal information. The full presentation sequence and fallback phrases are in [DEMO_GUIDE.md](DEMO_GUIDE.md).

## Accessibility behavior

- Every enabled action is keyboard reachable and uses native control semantics.
- Screen changes focus the new screen heading; requested validation focuses the first invalid control.
- Voice-tool highlighting focuses only allowlisted fields and adds a visible outline plus an accessible status announcement.
- Voice state is communicated in text. A single polite live region announces status, final agent captions, safety notices, and tool feedback; user partial captions are visible but not repeatedly announced.
- Controls use approximately 44-pixel or larger effective targets, visible focus, adjacent errors, and associated labels.
- The layout is tested at 320×800, 375×812, 768×1024, and 1440×900, with reduced motion and a 200% zoom-equivalent browser check.

## Privacy and safety

- Family Card and phone values remain only in in-memory React state and mask on blur.
- Raw form values never enter the voice screen context or tool results.
- Possible spoken sensitive values are replaced before entering visible caption state.
- The agent cannot accept terms, solve CAPTCHA, choose or confirm a facility, submit enrollment, access an official account, or execute arbitrary selectors, functions, JavaScript, or URLs.
- Voice failures do not reset the enrollment workflow.
- End Guidance sends `session.end`, waits briefly for `session.ended`, then releases the socket, microphone, playback, audio nodes, handlers, and pending work.
- No local storage, cookies, database, analytics, transcript storage, or audio storage is used.

## Real and simulated behavior

| Real in this MVP | Simulated or unavailable |
|---|---|
| AssemblyAI voice conversation, captions, audio playback, context updates, and client tool calls | BPJS Kesehatan enrollment, identity verification, eligibility, account access, and submission |
| Deterministic local validation and navigation | Official validation or healthcare-facility partnership data |
| In-memory masking and reset | Persistent drafts or records |
| English guidance | Bahasa Indonesia and regional languages |

The prototype stops at **Confirm Demo Completion**. That control records only an in-memory demo state and never sends an official registration request.

## Known limitations

- The MVP is English only.
- A live voice session requires working AssemblyAI credentials, network access, browser microphone permission, and audible output.
- The “slow” preference asks the agent to use shorter, more deliberate sentences; the current integration does not claim to change audio playback speed.
- Client-side caption redaction is defense in depth, not a production compliance or data-governance system.
- No usability or business-impact metrics have been measured.

Future localization, official integrations, identity verification, consent, submission, retention controls, and user research require separate scope and approval. See [QA_CHECKLIST.md](QA_CHECKLIST.md) for acceptance evidence and remaining live checks.
