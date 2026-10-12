const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

console.log('🚀 [Sentinel Auto-Updater] Watching directory for changes:', srcDir);

let debounceTimer = null;
let isBuilding = false;

function triggerBuild(filename) {
  if (isBuilding) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    isBuilding = true;
    console.log(`\n⚡ [Sentinel Auto-Updater] Detected change in: ${filename}`);
    console.log('📦 Rebuilding frontend bundle (quick:build)...');
    
    exec('npm run quick:build', { cwd: rootDir }, (err, stdout, stderr) => {
      isBuilding = false;
      if (err) {
        console.error('❌ Build failed:', stderr || err.message);
      } else {
        console.log('✅ [Sentinel Auto-Updater] Build updated successfully in dist/ at', new Date().toLocaleTimeString());
      }
    });
  }, 1200);
}

try {
  fs.watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    if (filename.endsWith('.tsx') || filename.endsWith('.ts') || filename.endsWith('.css') || filename.endsWith('.html')) {
      triggerBuild(filename);
    }
  });
  console.log('👀 Watching src/ for file changes. Press Ctrl+C to stop.');
} catch (e) {
  console.error('Failed to start watcher:', e);
}
