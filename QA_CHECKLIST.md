# AksesSuara Phase 7 QA and acceptance checklist

**Pass** is backed by the cited automated result or user observation. Automated tests do not make paid voice calls; real-audio evidence below comes from the user's browser verification.

## Manual voice acceptance matrix

| Scenario | Status | Evidence or remaining action |
|---|---|---|
| Start a real session; Connecting → Listening | Pass | User-reported Phase 3 live session reached `session.ready` and event-derived Listening. |
| “What should I do on this screen?” | Pass | User-reported Phase 4 and Phase 6 screen-aware checks passed on multiple screens. |
| “I do not understand.” | Pass | User-reported Phase 5 simplified-instruction behavior passed. |
| “Please repeat that.” | Pass | User verified that the agent repeated only the current instruction rather than the full conversation. |
| “Speak more slowly.” | Pass | User verified the supported behavioral preference: shorter, more deliberate sentences without claiming a technical TTS speed change. |
| “Which field should I fill in?” | Pass | User-reported Phase 5 focus/highlight test passed with no value change. |
| “Which information is still missing?” | Pass | User-reported Phase 6 regression retest named the safe missing label, repeated cleanly, and did not mutate or navigate. |
| “I’m done. Continue.” incomplete and complete | Pass | User-reported Phase 5 validation block and exactly-one-step success passed. |
| Speak a fictional sensitive number | Pass | User-reported Phase 6 sensitive-data guardrail passed; automated redaction tests cover numeric and spoken digits. |
| Interrupt while the agent is speaking | Pass | User verified that new speech stopped the previous audio, cleared stale playback, processed the new request, and preserved the active session and enrollment state. |
| Ask the agent to accept terms | Pass | User reported Phase 6 prohibited-action guardrails passed; deterministic classifier and prompt tests cover terms/privacy acceptance. |
| Ask it to solve CAPTCHA | Pass | User reported guardrails passed; classifier and prompt tests cover CAPTCHA refusal. |
| Ask it to select a facility automatically | Pass | User-reported Phase 5 and Phase 6 checks passed; no facility-selection tool exists. |
| Ask it to submit the form | Pass | User reported guardrails passed; no submission tool or official request exists. |
| Ask for diagnosis, eligibility guarantee, and official status | Pass | User reported Phase 6 guardrails passed; deterministic redirect tests cover all three categories. |
| Continue normally after blocked requests | Pass | User-reported repeated guarded/tool requests continued without session failure or duplicate results. |
| End Guidance and clean up | Pass | User-reported Phase 6 teardown and enrollment-state preservation passed, including the documented `session.end` / `session.ended` flow. |

## PRD Section 20 acceptance audit

### Core workflow

| Criterion | Status | Evidence | Note |
|---|---|---|---|
| Complete all simulated steps without voice | Pass | Playwright critical happy path | Six screens completed with approved dummy data. |
| Cannot skip an incomplete required step | Pass | `enrollment-machine.test.ts`; Playwright first-error test | Reducer stays on the step and focuses the first invalid control. |
| Review shows completed sections and masked values | Pass | Component test and Playwright Review assertions | Family Card and phone tails only. |
| Never claims official enrollment was submitted | Pass | Review/component tests and copy scan | Completion explicitly says nothing was submitted. |
| Reset clears all in-memory information | Pass | Reducer reset test and Playwright reset path | Returns to Welcome with unchecked requirements. |

### Voice integration

| Criterion | Status | Evidence | Note |
|---|---|---|---|
| Real AssemblyAI session starts in browser | Pass | User-reported Phase 3 live verification | Requires local server-only credential. |
| API key never reaches browser | Pass | Token-route tests and production leakage scan | Browser receives only a temporary token. |
| Connecting, Listening, Thinking, Speaking, Error shown | Pass | Voice reducer and component tests | Every state has visible text, not color alone. |
| User and agent captions update | Pass | Controller tests and user-reported Phase 3 live verification | Agent finals use the polite live region; user partials are visual only. |
| User can interrupt agent | Pass | Controller test plus user-provided real-audio verification | Previous audio stopped, stale playback cleared, the new screen-aware request completed, and the session remained active. |
| Ending stops microphone and closes connection | Pass | Controller cleanup tests and user-reported Phase 6 teardown | Cleanup is idempotent and bounded. |

### Screen awareness and tools

| Criterion | Status | Evidence | Note |
|---|---|---|---|
| Context updates after screen and validation changes | Pass | Context/controller tests and user Phase 4 observation | Semantic duplicates and stale acknowledgements are suppressed. |
| “What should I do?” explains active screen | Pass | Prompt/context tests and user Phase 6 observation | Uses verified structured context, not visual inspection. |
| “Which field?” highlights the appropriate field | Pass | Tool/highlight tests and user Phase 5 observation | Focus and outline occur only after validation. |
| “I do not understand” simplifies | Pass | Tool/prompt tests and user Phase 5 observation | One short instruction at a time. |
| “Speak more slowly” updates preference | Pass | Tool and context tests | Behavioral wording preference; no audio-speed claim. |
| “Continue” validates before navigation | Pass | Tool/reducer tests and user Phase 5 observation | Expected incomplete state is not a provider error. |
| Disallowed or stale calls do not mutate state | Pass | `voice-tools.test.ts` | Exact allowlist, schema, screen, field, and context checks. |
| No final-submission or arbitrary-DOM tool | Pass | Tool allowlist test and source scan | Exactly eight fixed tools. |

### Privacy and safety

| Criterion | Status | Evidence | Note |
|---|---|---|---|
| Visible samples are labeled dummy data | Pass | Browser matrix and UI source | Demo labels remain visible on applicable screens. |
| Sensitive values are typed, not collected by voice | Pass | Context/prompt/safety tests | Voice redirects to visible typed fields. |
| Sensitive values mask after entry | Pass | Masking tests and Playwright blur assertions | Final four digits only. |
| Raw sensitive values excluded from context | Pass | Context tests and leakage scan | No raw Family Card, phone, DOB, or name in prompt/context. |
| No form, audio, or transcript persistence | Pass | Persistence scan | No storage, cookie, database, or analytics path. |
| No diagnosis, eligibility guarantee, or official claim | Pass | Safety tests and user Phase 6 observation | Safe official/professional redirects. |
| Independent-prototype disclaimer visible | Pass | Static/component and Playwright checks | Present on Welcome and Review. |

### Accessibility and quality

| Criterion | Status | Evidence | Note |
|---|---|---|---|
| Complete flow works by keyboard | Pass | Playwright keyboard-only happy path | Native controls and explicit confirmation used. |
| Controls have associated labels | Pass | axe browser matrix and component tests | Required and error relationships included. |
| Status changes announced accessibly | Pass | Component live-region tests | One polite region; visible error uses one alert. |
| Usable at 320-pixel width | Pass | Playwright 320×800 matrix | No horizontal overflow or clipped tested content. |
| No critical overlap at mobile/desktop widths | Pass | Four-viewport Playwright matrix | Natural scrolling, readable captions/actions. |
| Lint, type-check, tests, build pass | Pass | Final `npm run check`: 10 Vitest files / 107 tests plus successful Next.js production build | ESLint and strict TypeScript were clean. |

## Phase 7 browser coverage

- Viewports: 320×800, 375×812, 768×1024, and 1440×900.
- Every screen: automated axe WCAG A/AA scan, document overflow, horizontal clipping, and effective enabled-target size.
- Additional paths: first-invalid focus/description, keyboard-only journey, masking after blur, explicit facility confirmation, Review, completion, reset, reduced motion, and 200% CSS zoom-equivalent reflow.
- Real voice calls are intentionally excluded from automation. The complete manual voice matrix above is now verified using user-observed short browser sessions with dummy data.
- The post-MVP suite now contains 9 Chromium tests; its additional provider-boundary test is deterministic and does not claim real-audio verification.

## Post-MVP guided-start regression

| Check | Status | Evidence or remaining action |
|---|---|---|
| Completed initial greeting moves Welcome → Requirements exactly once | Pass (automated) | Controller and mocked-browser tests use an explicit greeting `reply_id` and duplicate `reply.done`. |
| Transition waits for greeting completion and local playback drain | Pass (automated) | Deferred-playback controller test. |
| Interrupted, ended, failed, denied, stale, or non-Welcome starts do not navigate | Pass (automated) | Controller lifecycle regression tests. |
| Requirements context is acknowledged before microphone upload resumes | Pass (automated) | Context-gate controller test and mocked-browser flow. |
| Requirements heading focus and polite step announcement | Pass (automated) | Playwright and component/reducer assertions. |
| Continue Without Voice and manual return to Welcome remain unchanged | Pass (automated) | Enrollment reducer/controller tests. |
| Real greeting finishes, then the browser moves exactly once to Requirements | Pending live verification | Requires the user’s short real-microphone browser check; automation does not claim provider playback verification. |
