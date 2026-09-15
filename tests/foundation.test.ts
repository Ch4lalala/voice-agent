import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const readProjectFile = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Phase 0 foundation", () => {
  it("provides the required project scripts", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      dev: "next dev",
      lint: "eslint .",
      typecheck: "tsc --noEmit",
      test: "vitest run",
      build: "next build",
    });
  });

  it("keeps TypeScript strict mode enabled", () => {
    const tsconfig = JSON.parse(readProjectFile("tsconfig.json")) as {
      compilerOptions?: { strict?: boolean };
    };

    expect(tsconfig.compilerOptions?.strict).toBe(true);
  });

  it("documents empty credentials and ignores local environment files", () => {
    const environmentExample = readProjectFile(".env.example");
    const gitignore = readProjectFile(".gitignore");

    expect(environmentExample).toContain("ASSEMBLYAI_API_KEY=\n");
    expect(environmentExample).toContain("ASSEMBLYAI_AGENT_ID=\n");
    expect(environmentExample).toContain("NEXT_PUBLIC_DEMO_MODE=false");
    expect(environmentExample).not.toMatch(/ASSEMBLYAI_(?:API_KEY|AGENT_ID)=\S+/);
    expect(gitignore).toContain(".env*");
    expect(gitignore).toContain("!.env.example");
  });
});
