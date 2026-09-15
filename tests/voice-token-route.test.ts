import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../src/app/api/voice/token/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("POST /api/voice/token", () => {
  it("returns a safe configuration error when the server key is absent", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Voice guidance is not configured on this server.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns only the temporary token after successful server authentication", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "test-only-api-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "single-use-token", extra: "discarded" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ token: "single-use-token" });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://agents.assemblyai.com/v1/token");
    expect(url.searchParams.get("expires_in_seconds")).toBe("60");
    expect(url.searchParams.get("max_session_duration_seconds")).toBe("180");
    expect(init.headers).toEqual({ Authorization: "Bearer test-only-api-key" });
  });

  it("does not expose an upstream error response", async () => {
    vi.stubEnv("ASSEMBLYAI_API_KEY", "test-only-api-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("sensitive upstream diagnostic", { status: 401 }),
      ),
    );

    const response = await POST();
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(502);
    expect(serialized).not.toContain("upstream");
    expect(serialized).not.toContain("test-only-api-key");
  });
});
