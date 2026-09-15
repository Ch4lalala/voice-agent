import { serializeEnrollmentScreenContext } from "@/lib/enrollment-context";
import type {
  EnrollmentAllowedAction,
  EnrollmentScreenContext,
} from "@/types/enrollment";

const actionLabels: Record<EnrollmentAllowedAction, string> = {
  start_voice_guidance: "Start voice guidance",
  continue_without_voice: "Continue without voice",
  previous: "Previous",
  continue: "Continue",
  review_information: "Review information",
  edit_section: "Edit section",
  confirm_demo_completion: "Confirm demo completion",
  reset_demo: "Reset demo",
};

export const voiceAgentPromptBaseline = `You are AksesSuara, a patient voice accessibility guide embedded in a simulated public-service enrollment workflow. This is an independent hackathon prototype and is not an official BPJS Kesehatan service.

The application state machine is authoritative. Your only job is to explain the trusted application context below. Give one short instruction at a time in calm, plain English. Never invent fields, requirements, eligibility decisions, validation results, screen changes, or completed actions.

Never ask the user to speak an identification number, Family Card number, phone number, date of birth, medical detail, or other sensitive value aloud. Tell the user to type sensitive information into the visible application field. Never read a sensitive value back.

You currently have no tools and cannot highlight, validate, select, navigate, reset, confirm, submit, or otherwise control the interface. The listed actions are informational descriptions of visible manual controls only. If the user asks you to continue or change screens, tell them to use the named visible application control.

If asked what to do, explain the next incomplete required field or the next visible manual action. If asked what is missing, mention only incomplete fields and the supplied validation messages. If asked to repeat, repeat only your last instruction. If the user does not understand or asks for simpler language, restate one instruction using simpler words.

Do not provide medical diagnosis, legal advice, eligibility guarantees, or claims of official enrollment. Speak in English and keep each response to one or two short sentences.`;

function fieldLine(context: EnrollmentScreenContext, index: number): string {
  const field = context.fields[index];
  const status = field.complete ? "complete" : "incomplete";
  const validation = field.error ? ` Validation: ${field.error}` : "";
  return `- ${field.label}: ${field.description} Required: ${field.required ? "yes" : "no"}. Sensitive: ${field.sensitive ? "yes" : "no"}. Status: ${status}.${validation}`;
}

export function createVoiceAgentSystemPrompt(
  context: EnrollmentScreenContext,
): string {
  const fields = context.fields.length
    ? context.fields.map((_, index) => fieldLine(context, index)).join("\n")
    : "- No form fields are visible on this screen.";
  const required = context.fields.filter((field) => field.required).map((field) => field.label);
  const incomplete = context.fields
    .filter((field) => field.required && !field.complete)
    .map((field) => field.label);
  const errors = context.fields
    .filter((field) => field.error)
    .map((field) => `${field.label}: ${field.error}`);
  const actions = context.allowedActions.map((action) => actionLabels[action]);

  return `${voiceAgentPromptBaseline}

Trusted current application context:
- Screen identifier: ${context.screenId}
- Screen title: ${context.title}
- Enrollment step: ${context.step} of ${context.totalSteps}
- Required fields: ${required.length ? required.join(", ") : "none"}
- Incomplete required fields: ${incomplete.length ? incomplete.join(", ") : "none"}
- Sanitized validation errors: ${errors.length ? errors.join("; ") : "none"}
- Visible manual controls: ${actions.join(", ")}
- User may manually continue now: ${context.canProceed ? "yes" : "no"}

Visible field guidance:
${fields}`;
}

export function createVoiceContextSnapshot(context: EnrollmentScreenContext): {
  semanticKey: string;
  systemPrompt: string;
} {
  return {
    semanticKey: serializeEnrollmentScreenContext(context),
    systemPrompt: createVoiceAgentSystemPrompt(context),
  };
}
