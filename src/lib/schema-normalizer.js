// src/lib/schema-normalizer.js
import fs from "node:fs";
import path from "node:path";

/**
 * Load the target job schema from disk. The schema file must be a JSON object
 * where keys define the exact output fields (in the order you require).
 *
 * - Values act as defaults for missing fields (null, "", [], {} are all fine).
 * - If you prefer a custom location, set JOB_SCHEMA_PATH=/path/to/file.json
 */
export function loadTargetSchema() {
  const schemaPath =
    process.env.JOB_SCHEMA_PATH ||
    path.join(process.cwd(), "config", "target-schema.json");

  const raw = fs.readFileSync(schemaPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Schema must be a JSON object of key: defaultValue pairs.");
  }
  return parsed;
}

/**
 * Normalize a job object to EXACTLY the schema:
 *  - includes ALL schema keys (fills defaults for missing),
 *  - removes any extra keys not in schema,
 *  - preserves schema key order
 */
export function normalizeJobToSchema(job, schema) {
  const out = {};
  for (const key of Object.keys(schema)) {
    const val = job[key];
    out[key] =
      val === undefined || val === null || (typeof val === "string" && val.trim() === "")
        ? schema[key] ?? null
        : val;
  }
  return out;
}

/**
 * Small helper to wrap your existing writer function, so you only change
 * a single import where you call `writeJob`.
 *
 * Example:
 *   import { createSchemaWriter } from "./lib/schema-normalizer.js";
 *   import { writeJob as rawWriteJob } from "../io/writer.js";
 *   const writeJob = createSchemaWriter(rawWriteJob);
 *   await writeJob(job);
 */
export function createSchemaWriter(writeFn, schema = null) {
  const TARGET_SCHEMA = schema || loadTargetSchema();
  return async function writeWithSchema(job) {
    const normalized = normalizeJobToSchema(job, TARGET_SCHEMA);
    return writeFn(normalized);
  };
}
