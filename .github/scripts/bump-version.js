// bump-version.js — Incrémente la version patch et met à jour CHANGELOG.md
// Usage: node .github/scripts/bump-version.js
// Output: affiche la nouvelle version sur stdout

const fs = require('fs');
const { execSync } = require('child_process');

// ── Bump version ──────────────────────────────────────────────────────────────

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const newVersion = `${major}.${minor}.${patch + 1}`;
pkg.version = newVersion;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

// ── Génère les notes de version depuis les commits ────────────────────────────

const lastTag = (() => {
  try { return execSync('git describe --tags --abbrev=0 2>/dev/null').toString().trim(); }
  catch { return null; }
})();

const range   = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const commits = (() => {
  try {
    return execSync(`git log ${range} --pretty=format:"- %s" --no-merges`)
      .toString().trim();
  } catch { return ''; }
})();

const date  = new Date().toISOString().split('T')[0];
const notes = commits || '- Mise à jour';
const entry = `## v${newVersion} — ${date}\n\n${notes}\n\n`;

// ── Met à jour CHANGELOG.md ───────────────────────────────────────────────────

const existing   = fs.existsSync('CHANGELOG.md') ? fs.readFileSync('CHANGELOG.md', 'utf8') : '# Changelog\n\n';
const headerEnd  = existing.indexOf('\n\n') + 2;
const newContent = existing.slice(0, headerEnd) + entry + existing.slice(headerEnd);
fs.writeFileSync('CHANGELOG.md', newContent);

console.log(newVersion);
