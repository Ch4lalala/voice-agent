import { ScreenPreview } from "../ScreenPreview";
import { useVoiceGuide } from "@/components/voice/VoiceGuideProvider";

const disclaimer =
  "Independent hackathon prototype. This project is not affiliated with, endorsed by, or officially integrated with BPJS Kesehatan. It uses simulated screens and dummy data to demonstrate a proposed voice-assisted enrollment experience.";

type WelcomeScreenProps = { onContinue: () => void };

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  const { state: voiceState, start: startVoice } = useVoiceGuide();
  const voiceBusy = ["connecting", "listening", "thinking", "speaking"].includes(
    voiceState.status,
  );

  return (
    <ScreenPreview
      screenId="welcome"
      screenNumber={1}
      currentStep={0}
      title="Welcome to AksesSuara"
      description="Making essential digital services accessible through guided conversation."
    >
      <div className="welcome-panel">
        <div className="welcome-panel__lead">
          <span className="guidance-orbit" aria-hidden="true"><span /><span /><span /></span>
          <div>
            <p className="stage-kicker">A patient guide, beside you</p>
            <h2>I will guide you through each enrollment step.</h2>
            <p>
              Read each instruction and move at your own pace. You stay in control of every
              choice and every piece of information.
            </p>
          </div>
        </div>

        <ul className="welcome-points" aria-label="Guidance benefits">
          <li><span aria-hidden="true">01</span>One clear instruction at a time</li>
          <li><span aria-hidden="true">02</span>Sensitive details stay typed</li>
          <li><span aria-hidden="true">03</span>Final decisions remain yours</li>
        </ul>

        <div className="action-row">
          <button
            className="button button--primary"
            type="button"
            onClick={startVoice}
            disabled={voiceBusy}
            aria-describedby="voice-phase-note"
            aria-busy={voiceState.status === "connecting"}
          >
            <span className="button__mic" aria-hidden="true" />
            {voiceState.status === "error" ? "Retry Voice Connection" : "Start Voice Guidance"}
          </button>
          <button className="button button--secondary" type="button" onClick={onContinue}>
            Continue Without Voice
          </button>
          <span id="voice-phase-note" className="action-row__note">
            Starting voice will ask for microphone access. After the greeting finishes,
            guidance begins on Requirements. Your entries and important choices remain yours.
          </span>
        </div>

        <div className="accessibility-note">
          <span className="accessibility-note__icon" aria-hidden="true">Aa</span>
          <p>Live captions are shown when the service supplies them. You can ask the guide to repeat, simplify, or use shorter and more deliberate sentences.</p>
        </div>

        <aside className="disclaimer" aria-label="Independent prototype disclaimer">
          <strong>Independent prototype</strong>
          <p>{disclaimer}</p>
        </aside>
      </div>
    </ScreenPreview>
  );
}
