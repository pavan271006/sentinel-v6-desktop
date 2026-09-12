const fs = require('fs');
const path = require('path');

function getAllFiles(dir, extList = ['.ts', '.tsx']) {
  let files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== 'dist' && !item.name.startsWith('.')) {
        files = files.concat(getAllFiles(full, extList));
      }
    } else if (extList.some(e => item.name.endsWith(e)) && !item.name.endsWith('.d.ts') && !item.name.includes('.test.')) {
      files.push(full);
    }
  }
  return files;
}

const srcDir = path.resolve(__dirname, '../../src');
const srcFiles = getAllFiles(srcDir);
const graph = {};

for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  const importRegex = /(?:import|export)\s+(?:.+?\s+from\s+)?['"](\.[^'"]+)['"]/g;
  const deps = [];
  let m;
  while ((m = importRegex.exec(content)) !== null) {
    const targetBase = path.resolve(path.dirname(file), m[1]);
    const candidates = [
      targetBase,
      targetBase + '.ts',
      targetBase + '.tsx',
      path.join(targetBase, 'index.ts'),
      path.join(targetBase, 'index.tsx')
    ];
    let resolved = null;
    for (const c of candidates) {
      if (fs.existsSync(c) && !fs.statSync(c).isDirectory()) {
        resolved = c;
        break;
      }
    }
    if (resolved && !resolved.includes('.test.')) deps.push(resolved);
  }
  graph[file] = deps;
}

const cycles = [];
const cycleSignatures = new Set();

function findCycles(node, visited, recursionStack) {
  visited.add(node);
  recursionStack.push(node);

  for (const neighbor of graph[node] || []) {
    if (!visited.has(neighbor)) {
      findCycles(neighbor, visited, recursionStack);
    } else if (recursionStack.includes(neighbor)) {
      const cycle = recursionStack.slice(recursionStack.indexOf(neighbor));
      cycle.push(neighbor);
      // Normalized signature to deduplicate cycle
      const sig = [...cycle.slice(0, -1)].sort().join('::');
      if (!cycleSignatures.has(sig)) {
        cycleSignatures.add(sig);
        cycles.push(cycle);
      }
    }
  }

  recursionStack.pop();
}

const visited = new Set();
for (const file of srcFiles) {
  if (!visited.has(file)) {
    findCycles(file, visited, []);
  }
}

console.log('Detected circular cycles in production src/:', cycles.length);
cycles.forEach((c, idx) => {
  console.log(`\nCycle ${idx + 1}:`);
  c.forEach(f => console.log('  -> ' + path.relative(srcDir, f)));
});
