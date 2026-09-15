import { NextResponse } from "next/server";

import { requestAssemblyAiVoiceToken } from "@/lib/assemblyai-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export async function POST() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Voice guidance is not configured on this server." },
      { status: 503, headers: noStoreHeaders },
    );
  }

  try {
    const token = await requestAssemblyAiVoiceToken(apiKey);
    return NextResponse.json({ token }, { headers: noStoreHeaders });
  } catch {
    return NextResponse.json(
      { error: "Voice guidance could not connect. Please try again." },
      { status: 502, headers: noStoreHeaders },
    );
  }
}
