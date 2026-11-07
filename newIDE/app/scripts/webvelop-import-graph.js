#!/usr/bin/env node
/**
 * Webvelop maintenance tool: computes the import closure of one or more
 * entry files of the editor (static imports, dynamic imports and requires
 * of relative paths).
 *
 * Usage:
 *   node scripts/webvelop-import-graph.js src/index.js            -> list reachable files
 *   node scripts/webvelop-import-graph.js --unreachable src/index.js -> list src files NOT reachable
 *   node scripts/webvelop-import-graph.js --why <file> src/index.js  -> show an import chain to <file>
 *   node scripts/webvelop-import-graph.js --packages src/index.js    -> list npm packages used
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
let whyTarget = null;
const entries = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--why') {
    whyTarget = path.resolve(args[++i]);
    continue;
  }
  if (!args[i].startsWith('--')) entries.push(path.resolve(args[i]));
}

const appRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(appRoot, 'src');
const importRegex = /(?:(import|export)\s+([^'";]*?)\s+from\s+|import\s+|import\(\s*(?:\/\*[^*]*\*\/\s*)?|require\(\s*)['"]([^'"]+)['"]/g;

// Flow type-only imports are stripped by Babel: they are not real dependencies.
const isTypeOnly = (keyword, clause) => {
  if (!keyword || !clause) return false;
  const c = clause.trim();
  if (/^type\s/.test(c) || /^typeof\s/.test(c)) return true;
  const braces = c.match(/^\{([\s\S]*)\}$/);
  if (!braces) return false;
  const specifiers = braces[1]
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  return specifiers.length > 0 && specifiers.every(s => /^(type|typeof)\s/.test(s));
};

const resolveFile = (fromFile, request) => {
  const base = path.resolve(path.dirname(fromFile), request);
  const candidates = [
    base,
    base + '.js',
    base + '.jsx',
    base + '.json',
    path.join(base, 'index.js'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch (e) {}
  }
  return null;
};

const parents = new Map();
const visited = new Set();
const packages = new Set();
const missing = [];
const queue = [...entries];
entries.forEach(e => parents.set(e, null));
while (queue.length) {
  const file = queue.shift();
  if (visited.has(file)) continue;
  visited.add(file);
  if (!/\.(js|jsx)$/.test(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  let match;
  importRegex.lastIndex = 0;
  while ((match = importRegex.exec(content))) {
    const request = match[3];
    if (isTypeOnly(match[1], match[2])) continue;
    if (request.startsWith('.')) {
      const resolved = resolveFile(file, request);
      if (!resolved) {
        missing.push(`${path.relative(appRoot, file)} -> ${request}`);
        continue;
      }
      if (!parents.has(resolved)) parents.set(resolved, file);
      if (!visited.has(resolved)) queue.push(resolved);
    } else {
      const parts = request.split('/');
      packages.add(request.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]);
    }
  }
}

const listAll = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? listAll(p) : [p];
  });

if (whyTarget) {
  const chain = [];
  let current = whyTarget;
  if (!parents.has(current)) {
    console.log('Not reachable.');
    process.exit(0);
  }
  while (current) {
    chain.push(path.relative(appRoot, current));
    current = parents.get(current);
  }
  console.log(chain.reverse().join('\n  -> '));
} else if (flags.has('--unreachable')) {
  listAll(srcRoot)
    .filter(f => !visited.has(f))
    .forEach(f => console.log(path.relative(appRoot, f)));
} else if (flags.has('--packages')) {
  [...packages].sort().forEach(p => console.log(p));
} else {
  [...visited].sort().forEach(f => console.log(path.relative(appRoot, f)));
}
if (missing.length && !flags.has('--quiet')) {
  console.error('\nUnresolved relative imports:\n  ' + missing.join('\n  '));
}
