#!/usr/bin/env node
import fs from 'node:fs/promises';

export async function runCompare({ base, head }) {
  if (!base || !head) throw new Error('Usage: siteshot compare --base audit/old/manifest.json --head audit/new/manifest.json');
  const a = JSON.parse(await fs.readFile(base, 'utf8'));
  const b = JSON.parse(await fs.readFile(head, 'utf8'));
  const ai = [...(a.siteWideIssues || []), ...a.results.flatMap(p => p.captures.flatMap(c => c.issues || []))];
  const bi = [...(b.siteWideIssues || []), ...b.results.flatMap(p => p.captures.flatMap(c => c.issues || []))];
  console.log('# SiteShot comparison');
  console.log(`Base issues: ${ai.length}`);
  console.log(`Head issues: ${bi.length}`);
  console.log(`Difference: ${bi.length - ai.length}`);
}
