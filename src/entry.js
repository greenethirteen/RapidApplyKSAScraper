// src/entry.js
// Ensure env is loaded + AI guard runs before anything else.
import "dotenv/config";
import "./force-normalizer.js";
// Then boot your existing app (no changes needed elsewhere).
import "./index.js";
