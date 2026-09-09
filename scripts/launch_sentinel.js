import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const shortcutPath = path.join(
  process.env.APPDATA || '',
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Sentinel.lnk'
);

console.log('Target shortcut:', shortcutPath);
if (fs.existsSync(shortcutPath)) {
  console.log('Shortcut found. Launching Sentinel shortcut...');
  try {
    execSync(`start "" "${shortcutPath}"`, { shell: 'cmd.exe' });
    console.log('Launch command issued successfully!');
  } catch (e) {
    console.error('Error launching shortcut:', e.message);
  }
} else {
  console.log('Shortcut not found, launching direct release binary...');
  const releaseExe = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'sentinel-desktop.exe');
  execSync(`start "" "${releaseExe}"`, { shell: 'cmd.exe' });
  console.log('Release binary launched!');
}
