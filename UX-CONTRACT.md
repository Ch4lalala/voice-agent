# AksesSuara UX Contract

## Product context

- **Audience:** Indonesian adults who may benefit from a calm, guided enrollment walkthrough, including older adults and people with low digital confidence.
- **Primary job:** Complete a fictional healthcare enrollment demonstration accurately, with optional screen-aware voice requests constrained by verified client tools and the authoritative application state machine.
- **Market and language:** Indonesia-oriented public-service concept; the MVP interface, validation, prompt, tool feedback, safety notices, and captions are English only.
- **Usage context:** Mobile-first personal devices with desktop support. The interface must remain usable at 320 × 800, 375 × 812, 768 × 1024, and 1440 × 900.
- **Accessibility target:** WCAG 2.2 AA, keyboard operation, visible focus, adjacent errors, and first-invalid-field focus.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Phase scope, prohibited actions, sensitive-speech behavior, errors, privacy, disclaimer, and demo boundary | `AksesSuara-PRD.md` §§1.9, 2.5, 12, 13.3–13.4, 15–17 | Product and technical specification | 2026-09-16 |
| Browser token, WebSocket ordering, mutable system-prompt updates, events, audio, and session configuration | Official AssemblyAI Voice Agent API documentation | Current provider documentation | 2026-09-15 |
| Visual language and interaction principles | `DESIGN.md` | Project design context | 2026-09-15 |

No real enrollment, submission, identity verification, healthcare decision, or official BPJS Kesehatan integration exists in this phase. AssemblyAI receives only predefined screen metadata and sanitized completion/validation state. Its eight fixed tools can request allowlisted local behavior but cannot read values, confirm important choices, or bypass the reducer. Client caption safety is defense in depth; the system prompt remains responsible for the spoken refusal because the current Voice Agent inline configuration does not expose the separate transcript Guardrails PII-redaction options.

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
| Voice screen context | Deterministic context builder plus serialized session-update controller | `enrollment-context.ts`, `voice-context.ts`, `voice-agent-client.ts` | Sanitized informational context only | Context and controller tests |
| Voice client tools | Strict pure dispatcher plus reducer-owned events and fixed highlight mapping | `voice-tools.ts`, `voice-highlight.ts`, `EnrollmentWorkflow.tsx` | Eight named Phase 5 tools only | Tool, controller, and browser tests |
| Voice privacy and safety | Pure safety classifier/redactor plus embedded warning state | `voice-safety.ts`, `voice-agent-client.ts`, `voice-state.ts`, `VoiceGuide.tsx` | Sensitive-data, prohibited-action, out-of-scope, and timeout recovery only | Safety and controller tests plus manual voice verification |

## Component behavior

| Component | Default | Hover / active | Focus | Disabled | Error |
|---|---|---|---|---|---|
| Button | Clear text action and 44 px minimum target | Token-based emphasis without layout shift | Visible two-color focus ring | Muted with explanatory nearby copy where relevant | n/a |
| Input/select | Label and hint remain visible | Border emphasis | Visible two-color focus ring | Not used in manual forms | `aria-invalid` plus adjacent `role="alert"` message |
| Sensitive input | Masked while blurred | Raw in-memory value appears only while focused for safe editing | Selectable text cursor and standard focus ring | n/a | Same adjacent error contract |
| Checkbox/radio card | Entire label is the target | Surface and border emphasis | `:focus-within` ring | Not used | Group/field error is adjacent and described |
| Voice Guide | Off with explicit Start | Event-derived status, waveform, verified-action feedback, and allowlisted privacy/safety notices | Standard visible focus ring; requested field receives temporary amber focus emphasis | Separate Repeat and slower-speech buttons remain command reminders | Adjacent `role="alert"`, recoverable timeout/connection errors, Retry Connection, manual workflow remains available |

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
| Start voice on Welcome | Start Voice Guidance | Connecting; acknowledged Welcome context; completed real greeting; deterministic move to Requirements; acknowledged Requirements context; Listening | Any permission, token, connection, context, interrupted-greeting, playback, or end-session failure stays on Welcome; manual enrollment remains available | Requirements heading after the successful transition | Post-MVP guided-start contract |
| Start or retry voice after Welcome | Start Voice Guidance / Retry Connection | Current screen remains active, then event-derived live state | Permission or connection error with Retry; manual enrollment remains available | No enrollment-navigation focus change | PRD Phase 3 |
| End voice | End Guidance | Stop audio upload, send `session.end`, receive `session.ended` or reach the one-second fallback, then return Off after local cleanup | Bounded local cleanup still runs if the acknowledgement or connection is unavailable | End control | PRD Phase 3 and current AssemblyAI events reference |
| Synchronize voice context | Manual screen, completion, or visible-validation change | Latest sanitized prompt acknowledged by AssemblyAI | Duplicate state is suppressed; pre-ready and in-flight changes collapse or serialize to the latest state | No focus change | PRD Phase 4 and §10 |
| Execute voice tool | Allowlisted `tool.call`, then completed `reply.done` | Structured `tool.result`; optional deterministic focus, validation, or one-step reducer event | Unknown, malformed, unavailable, stale, duplicate, or interrupted calls are blocked without mutation | Requested field, first invalid field, or destination heading | PRD Phase 5 and §11 |
| Detect spoken sensitive data or prohibited request | Final live user transcript | Redacted caption where applicable plus a predefined inline safety notice; prompt directs a concise spoken refusal | Continue manually; no form value is inferred or stored | No automatic focus change | PRD Phase 6, §§12–13.3 |

## Navigation, feedback, and resilience

- The workflow is a single-page, fixed-order state machine; no query string or route can skip steps.
- The document title follows the active screen. New screens focus their `<h1>` without scrolling obstruction.
- Reset confirmation is inline in the header rather than an overlay. It never traps focus.
- The optional voice connection, ordered context acknowledgements, and ordered client-tool exchange are the only asynchronous Phase 5 operations. Connecting is visibly busy until `session.ready` and the latest initial context update are acknowledged; permission and connection failures remain inline and recoverable. There are no toasts, persistence, autosave, offline writes, or multi-tab synchronization.
- Refresh intentionally creates fresh reducer state and clears all data. This is the PRD-defined privacy behavior, so there is no unsaved-change guard.
- Voice Guide state is owned by one provider above the changing enrollment screens, so an active session is not duplicated or discarded during step navigation. Microphone access starts only after an explicit Start action.
- Page exit, provider unmount, explicit End, and irrecoverable connection failure stop all microphone tracks, release audio resources, detach socket handlers, and close the session.
- Voice state and enrollment state remain isolated. The reducer publishes a sanitized `EnrollmentScreenContext`. A fixed client dispatcher may propose a typed reducer event, but only after exact-name, exact-argument, active-action, active-field, and semantic-context checks pass. Rejected calls return safe structured results and cannot mutate state.
- The initial full `session.update` configures the prompt baseline, the eight flat-schema client tools, `min_latency` English transcription, adaptive turn detection, output, greeting, and the latest complete screen context. `session.ready` confirms that resolved configuration; if its echoed prompt does not match, the controller sends the latest complete baseline-plus-context prompt through a mutable system-prompt-only `session.update`. Microphone frames are forwarded only after the current prompt is acknowledged. Later semantic changes are serialized one at a time, and an acknowledgement is accepted only when its echoed prompt matches the one in flight.
- A voice session explicitly started on Welcome arms one initial-greeting boundary keyed to the first real `reply_id`. Only a matching `reply.done` with `status: "completed"`, a successfully acknowledged Welcome context, and drained local greeting playback may request the reducer-owned Welcome → Requirements transition. Interrupted, cancelled, failed, duplicate, stale, or later replies cannot navigate. The boundary is never re-armed within that session, including after a manual return to Welcome.
- During the guided Welcome → Requirements change, microphone frames remain gated until the complete Requirements prompt receives its matching `session.updated` acknowledgement. The Requirements heading then receives focus and the existing polite live region announces “Requirements, step 1 of 5.” before normal Listening resumes.
- Context changes before readiness replace the queued snapshot. Changes during another context update retain only the latest desired snapshot, and duplicate semantic snapshots do not send a WebSocket message. Audio starts only after the initial contextual prompt is acknowledged.
- A `tool.call` is captured with the context key the agent actually received. Execution waits until a non-interrupted `reply.done` is the latest protocol event. The controller removes the call from its pending queue before execution and sends one official-schema, JSON-stringified `tool.result` per unique call ID; interrupted pending calls are discarded, duplicate or late terminal events are no-ops, and tool rejection never closes the session.
- Expected product blocks such as incomplete fields or Review not yet being available use `is_error: false` inside the structured result. Only malformed, stale, unavailable, or failed tool execution uses `is_error: true`. The current official `tool.result` event has no envelope-level `is_error` or `response_instructions` field, so those unsupported fields are not sent; the complete prompt and safe result message govern the continuation.
- The matching `tool.result` is sent before applying any local UI effect and before transmitting a semantic context update caused by that effect. Successful UI mutations then regenerate and queue the sanitized context. A tool based on an older context key is blocked before execution, while a context change produced by the executing tool cannot retroactively invalidate it. Highlight targets use stable application field identifiers and fixed code-owned DOM mappings, never model-provided selectors.
- Live captions are transient React state and are cleared when the session ends. Audio, captions, tokens, transcripts, and session identifiers are never persisted or logged.
- Current official AssemblyAI events report `agent_timeout` if startup does not complete within ten seconds; it maps to a concise recoverable error and full local cleanup. Each client tool also declares a ten-second provider timeout, after which the provider continues the session. The client creates no second tool timer; sending the one matching `tool.result` resolves the provider-side call, so no late client timeout can emit another result. Retry always obtains a fresh single-use browser token.
- End Guidance first stops audio upload, sends the documented `session.end` event once, and waits for the documented `session.ended` response or a one-second fallback. It then closes any remaining socket, stops microphone tracks and playback, releases audio nodes/contexts, removes handlers, and clears pending tool/context work. This avoids the provider's billable 30-second resumable grace period while keeping cleanup idempotent.
- The temporary Phase 6 timing-diagnostics state, disclosure UI, styles, and tests are removed from the presentation-ready MVP and production bundle.
- One polite live region owns non-error voice announcements. It prioritizes safe notices, tool feedback, guidance-end feedback, final agent captions, and status text. User partial captions are visible but are not live-region messages; recoverable connection errors use one adjacent alert and focus the Retry control.

## Validation and sensitive data

- `src/lib/validation.ts` is the only validation-policy owner. Forms use `noValidate` so browser bubbles cannot conflict with application errors.
- Validation runs when Continue/Return to review is requested. Once an error is visible, editing that field updates its error deterministically.
- Family Card Number requires 16 digits. Dummy phone numbers require 10–13 digits beginning with `0`. Date requires a real `YYYY-MM-DD` date from 1900 through 2026. All requirements, relationship, fictional full name, and confirmed facility are required.
- Family Card Number reveals only its final four digits when blurred. Phone number reveals only its final four digits when blurred (the PRD permits three or four). Focusing restores the original in-memory value for editing without reparsing the mask.
- Raw sensitive values live only inside the active React reducer state. Screen context contains allowlisted identifiers, predefined labels/descriptions, completion, deterministic visible validation state, sensitivity flags, informational manual actions, and `canProceed`; it never contains field values. Date of birth is also marked sensitive in voice context.
- Prompt and tool-result construction interpolate only deterministic identifiers, predefined metadata, and regenerated validation messages. Arbitrary error text and form values cannot enter prompts or results.
- User caption text containing digit fragments or spoken digit words is replaced before entering React state. Final transcripts are classified only into fixed safety categories; notices never interpolate the raw utterance. Agent captions receive the same defensive long-number redaction, while the prompt forbids repeating sensitive values in speech.
- `slow` is a behavioral wording preference because the current Voice Agent API has no mutable speech-rate field. The prompt requests shorter, more deliberate sentences and the result explicitly reports that audio speed did not change.
- The Review screen renders masked sensitive values. No value is logged, persisted, transmitted, or embedded in context attributes.

## Verification contract

- Static gate: `npm run check`.
- Design-context gates: DESIGN.md lint and strict premium UI audit.
- Runtime matrix: Chromium at 320 × 800, 375 × 812, 768 × 1024, and 1440 × 900, plus reduced-motion and 200% zoom-equivalent reflow checks.
- Runtime evidence covers the complete manual flow, blocked transitions, first-error focus, masking after blur, confirmation-before-selection, edit-return, completion, reset, refresh, expected voice-error recovery, microphone cleanup, network responses, and horizontal overflow.
- Unit/component coverage lives in the enrollment tests plus `tests/voice-context.test.ts`, `tests/voice-tools.test.ts`, `tests/voice-state.test.ts`, `tests/voice-session-controller.test.ts`, and `tests/voice-token-route.test.ts`.
- Critical browser, keyboard-only, responsive, reduced-motion, zoom, and axe coverage lives in `e2e/enrollment.spec.ts`. The suite uses no AssemblyAI credential and makes no paid voice call.
