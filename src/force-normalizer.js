// src/force-normalizer.js
// Load .env and enforce AI ON; fail fast if OPENAI_API_KEY is missing.
import "dotenv/config";

const key = process.env.OPENAI_API_KEY?.trim();
if (!key) {
  console.error(
    "[Fatal] OPENAI_API_KEY is required.\n" +
    "• Local: export OPENAI_API_KEY=sk-...\n" +
    "• Railway: add OPENAI_API_KEY in Variables\n"
  );
  process.exit(1);
}

// Lock the feature ON (cannot be disabled by env)
process.env.ENABLE_AI_NORMALIZER = "1";

if (process.env.NODE_ENV !== "test") {
  console.log("[AI] Mandatory mode: ENABLE_AI_NORMALIZER=1 (cannot be turned off)");
}
