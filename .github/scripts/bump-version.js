// bump-version.js — Versioning sémantique basé sur les préfixes de commit
// Usage: node .github/scripts/bump-version.js
// Output: nouvelle version sur stdout, ou "none" si aucun bump nécessaire

const fs = require('fs');
const { execSync } = require('child_process');

// ── Commits depuis le dernier tag ─────────────────────────────────────────────

const lastTag = (() => {
  try { return execSync('git describe --tags --abbrev=0 2>/dev/null').toString().trim(); }
  catch { return null; }
})();

const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';

const commitLines = (() => {
  try {
    return execSync(`git log ${range} --pretty=format:"%s" --no-merges`)
      .toString().trim().split('\n').filter(Boolean);
  } catch { return []; }
})();

// ── Déterminer le type de bump ────────────────────────────────────────────────

// Préfixes qui déclenchent un bump
const MAJOR_RE = /^feat!|^BREAKING CHANGE:/i;
const MINOR_RE = /^feat(\(.+\))?:/i;
const PATCH_RE = /^fix(\(.+\))?:/i;
// chore, docs, test, refactor, perf, ci → aucun bump

let bumpType = 'none';
for (const msg of commitLines) {
  if (MAJOR_RE.test(msg)) { bumpType = 'major'; break; }
  if (MINOR_RE.test(msg) && bumpType !== 'major') bumpType = 'minor';
  if (PATCH_RE.test(msg) && bumpType === 'none') bumpType = 'patch';
}

if (bumpType === 'none') {
  console.log('none');
  process.exit(0);
}

// ── Calculer la nouvelle version ──────────────────────────────────────────────

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
let [major, minor, patch] = pkg.version.split('.').map(Number);

if (bumpType === 'major') { major++; minor = 0; patch = 0; }
else if (bumpType === 'minor') { minor++; patch = 0; }
else { patch++; }

const newVersion = `${major}.${minor}.${patch}`;
pkg.version = newVersion;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

// ── Notes de version (uniquement feat et fix) ─────────────────────────────────

const NOTABLE_RE = /^(feat|fix)(\(.+\))?(!)?:/i;
const notableCommits = commitLines.filter(m => NOTABLE_RE.test(m) || MAJOR_RE.test(m));
const allCommits = commitLines.filter(Boolean);

const notes = (notableCommits.length ? notableCommits : allCommits)
  .map(m => `- ${m}`)
  .join('\n') || '- Mise à jour';

// ── Mettre à jour CHANGELOG.md ────────────────────────────────────────────────

const date = new Date().toISOString().split('T')[0];
const entry = `## v${newVersion} — ${date}\n\n${notes}\n\n`;

const existing  = fs.existsSync('CHANGELOG.md') ? fs.readFileSync('CHANGELOG.md', 'utf8') : '# Changelog\n\n';
const headerEnd = existing.indexOf('\n\n') + 2;
fs.writeFileSync('CHANGELOG.md', existing.slice(0, headerEnd) + entry + existing.slice(headerEnd));

console.log(newVersion);
