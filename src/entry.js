// Ensures `globalThis.File` and other web APIs exist on Node runtimes
// that don't provide them (Node <= 20). This MUST run before anything
// imports the OpenAI client (directly or indirectly).
import 'openai/shims/node';

// Force the AI normalizer ON in all environments (Railway cron, dev, etc.)
import './force-normalizer.js';

// Now start your existing app (no other code changes required)
import './index.js';
