const TOKEN_ENDPOINT = "https://agents.assemblyai.com/v1/token";
const TOKEN_TTL_SECONDS = 60;
const MAX_SESSION_DURATION_SECONDS = 180;

type FetchImplementation = typeof fetch;

export class VoiceTokenError extends Error {
  constructor(public readonly kind: "upstream" | "invalid-response") {
    super("Unable to create a voice session token.");
    this.name = "VoiceTokenError";
  }
}

export async function requestAssemblyAiVoiceToken(
  apiKey: string,
  fetchImplementation: FetchImplementation = fetch,
): Promise<string> {
  const url = new URL(TOKEN_ENDPOINT);
  url.searchParams.set("expires_in_seconds", String(TOKEN_TTL_SECONDS));
  url.searchParams.set(
    "max_session_duration_seconds",
    String(MAX_SESSION_DURATION_SECONDS),
  );

  const response = await fetchImplementation(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!response.ok) throw new VoiceTokenError("upstream");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new VoiceTokenError("invalid-response");
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    typeof (payload as { token?: unknown }).token !== "string" ||
    !(payload as { token: string }).token
  ) {
    throw new VoiceTokenError("invalid-response");
  }

  return (payload as { token: string }).token;
}
