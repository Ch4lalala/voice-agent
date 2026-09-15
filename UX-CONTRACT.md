# AksesSuara UX Contract

## Product context

- **Audience:** Indonesian adults who may benefit from a calm, guided enrollment walkthrough, including older adults and people with low digital confidence.
- **Primary job:** Complete a fictional healthcare enrollment demonstration accurately, with an optional basic voice conversation that cannot control the workflow.
- **Market and language:** Indonesia-oriented public-service concept; Phase 3 interface, validation, prompt, and captions are English only.
- **Usage context:** Mobile-first personal devices with desktop support. The interface must remain usable at 320 × 800 and 1440 × 900.
- **Accessibility target:** WCAG 2.2 AA, keyboard operation, visible focus, adjacent errors, and first-invalid-field focus.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Phase scope, field rules, privacy, disclaimer, and demo boundary | `AksesSuara-PRD.md` §§1.6, 2.5, 5.2, 5.5, 5.6, 7, 9.2, 16 Phase 2 | Product and technical specification | 2026-09-15 |
| Browser token, WebSocket, events, audio, and session configuration | Official AssemblyAI Voice Agent API documentation | Current provider documentation | 2026-09-15 |
| Visual language and interaction principles | `DESIGN.md` | Project design context | 2026-09-15 |

No real enrollment, submission, identity verification, healthcare decision, or official BPJS Kesehatan integration exists in this phase. AssemblyAI provides only the optional basic voice session.

## Visual contract

- `DESIGN.md` owns visual rationale. `src/app/globals.css` owns runtime tokens and responsive styling.
- Phase 1’s independent AksesSuara identity, warm paper surfaces, teal primary controls, amber guidance, typography, radii, and spacing remain canonical.
- Shared screen chrome is owned by `ScreenPreview`; fields by `PreviewField`; sensitive entry by `SensitiveInput`; workflow state by the enrollment reducer.

## Canonical UI map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Browser-native `<select>` | `FamilyInformationScreen.tsx` | Native only | Keyboard and browser walkthrough |
| Date | Typed text input | `ParticipantInformationScreen.tsx` | `YYYY-MM-DD` only | Deterministic validation tests and browser walkthrough |
| Form | React reducer plus shared fields | `enrollment-machine.ts`, `PreviewField.tsx`, `SensitiveInput.tsx` | Requirements, family, participant, facility | Unit, component, and browser validation checks |
| Scrollbar | Browser-native global behavior | `globals.css` | No custom geometry | 320 px and 1440 px overflow checks |
| Voice permission | Explicit Start action plus browser permission prompt | `VoiceGuideProvider.tsx`, `voice-agent-client.ts` | Start, end, retry, and recoverable error only | Controller tests and browser failure checks |
| Live voice state | AssemblyAI connection and voice events | `voice-state.ts`, `VoiceGuide.tsx` | Off, Connecting, Listening, Thinking, Speaking, Error | Reducer and controller tests |

## Component behavior

| Component | Default | Hover / active | Focus | Disabled | Error |
|---|---|---|---|---|---|
| Button | Clear text action and 44 px minimum target | Token-based emphasis without layout shift | Visible two-color focus ring | Muted with explanatory nearby copy where relevant | n/a |
| Input/select | Label and hint remain visible | Border emphasis | Visible two-color focus ring | Not used in manual forms | `aria-invalid` plus adjacent `role="alert"` message |
| Sensitive input | Masked while blurred | Raw in-memory value appears only while focused for safe editing | Selectable text cursor and standard focus ring | n/a | Same adjacent error contract |
| Checkbox/radio card | Entire label is the target | Surface and border emphasis | `:focus-within` ring | Not used | Group/field error is adjacent and described |
| Voice Guide | Off with explicit Start | Event-derived status and waveform | Standard visible focus ring | Repeat and slower speech remain unavailable | Adjacent `role="alert"`, Retry Connection, manual workflow remains available |

## Flow ledger

| Operation | Trigger | Success destination | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|
| Start manual flow | Continue Without Voice | Requirements | n/a | Requirements screen heading | PRD Phase 2 |
| Advance | Continue | Next incomplete-order step | Stay on step and show deterministic adjacent errors | First invalid field | PRD §§5.2, 16 Phase 2 |
| Return | Previous | Prior step | n/a | Destination heading | PRD Phase 2 |
| Confirm facility | Confirm this facility | Facility remains selected on current step | Cancel returns to the candidate radio; unconfirmed candidates are never selected | Confirmation action, then normal flow | PRD §5.6 |
| Edit review section | Edit section | Requested completed step | Invalid edits stay on that step | Destination heading or first invalid field | PRD Phase 2 |
| Finish an edit | Return to review | Review | Same validation recovery as Continue | Review heading | PRD Phase 2 |
| Review details | Review Information | Review remains visible | n/a | Review summary heading | PRD Phase 2 |
| Complete demo | Confirm Demo Completion | Review success notice | n/a | Completion heading | PRD §2.5 |
| Reset | Reset Demo, then explicit reset action | Welcome with initial state | Keep my information cancels and restores trigger focus | Welcome heading after reset | PRD Phase 2 |
| Start voice | Start Voice Guidance | Connecting, then event-derived live state | Permission or connection error with Retry; manual enrollment remains available | Trigger remains in embedded guide | PRD Phase 3 |
| End voice | End Guidance | Off after explicit session termination and local cleanup | Local cleanup still runs if the connection is unavailable | End control | PRD Phase 3 |

## Navigation, feedback, and resilience

- The workflow is a single-page, fixed-order state machine; no query string or route can skip steps.
- The document title follows the active screen. New screens focus their `<h1>` without scrolling obstruction.
- Reset confirmation is inline in the header rather than an overlay. It never traps focus.
- The optional voice connection is the only asynchronous Phase 3 operation. Connecting is visibly busy; permission and connection failures are inline and recoverable. There are no toasts, persistence, autosave, offline writes, or multi-tab synchronization.
- Refresh intentionally creates fresh reducer state and clears all data. This is the PRD-defined privacy behavior, so there is no unsaved-change guard.
- Voice Guide state is owned by one provider above the changing enrollment screens, so an active session is not duplicated or discarded during step navigation. Microphone access starts only after an explicit Start action.
- Page exit, provider unmount, explicit End, and irrecoverable connection failure stop all microphone tracks, release audio resources, detach socket handlers, and close the session.
- Voice state and enrollment state are isolated. A voice failure cannot reset or mutate form data, and no `EnrollmentScreenContext` is sent to AssemblyAI in Phase 3.
- Live captions are transient React state and are cleared when the session ends. Audio, captions, tokens, transcripts, and session identifiers are never persisted or logged.

## Validation and sensitive data

- `src/lib/validation.ts` is the only validation-policy owner. Forms use `noValidate` so browser bubbles cannot conflict with application errors.
- Validation runs when Continue/Return to review is requested. Once an error is visible, editing that field updates its error deterministically.
- Family Card Number requires 16 digits. Dummy phone numbers require 10–13 digits beginning with `0`. Date requires a real `YYYY-MM-DD` date from 1900 through 2026. All requirements, relationship, fictional full name, and confirmed facility are required.
- Family Card Number reveals only its final four digits when blurred. Phone number reveals only its final four digits when blurred (the PRD permits three or four). Focusing restores the original in-memory value for editing without reparsing the mask.
- Raw sensitive values live only inside the active React reducer state. Screen context contains metadata, completion, and validation state, never field values.
- The Review screen renders masked sensitive values. No value is logged, persisted, transmitted, or embedded in context attributes.

## Verification contract

- Static gate: `npm run check`.
- Design-context gates: DESIGN.md lint and strict premium UI audit.
- Runtime matrix: Chrome-compatible browser at approximately 320 × 800 and 1440 × 900.
- Runtime evidence covers the complete manual flow, blocked transitions, first-error focus, masking after blur, confirmation-before-selection, edit-return, completion, reset, refresh, expected voice-error recovery, microphone cleanup, network responses, and horizontal overflow.
- Unit/component coverage lives in the enrollment tests plus `tests/voice-state.test.ts`, `tests/voice-session-controller.test.ts`, and `tests/voice-token-route.test.ts`.
