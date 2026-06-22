import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const skillPath = path.join(
      process.cwd(),
      "skills",
      "altbook-agent",
      "SKILL.md",
    );
    const markdown = await readFile(skillPath, "utf8");

    return new Response(markdown, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  } catch {
    return new Response("AltBook agent skill not found.", {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}
