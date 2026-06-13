#!/usr/bin/env node
/**
 * Fetch email webhook secret from linked Supabase DB (for setup scripts).
 */
import { spawnSync } from 'node:child_process';

export function fetchDbSetting(key) {
  const sql = `SELECT value FROM app_internal_settings WHERE key = '${key}' LIMIT 1;`;
  const result = spawnSync('supabase', ['db', 'query', '--linked', '-o', 'json', sql], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (result.status !== 0) return null;
  try {
    const parsed = JSON.parse(result.stdout);
    return parsed.rows?.[0]?.value ?? null;
  } catch {
    return null;
  }
}
