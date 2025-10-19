// src/force-normalizer.js
// Force the AI normalizer ON in any environment (Railway cron/job, dev, etc.)
// Import this once at the very top of your entrypoint:  import "./force-normalizer.js";

process.env.ENABLE_AI_NORMALIZER = '1';
if (process.env.NODE_ENV !== 'test') {
  console.log("[Normalizer] ENABLE_AI_NORMALIZER forced to 1");
}
