import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';

const configured = process.env.BLENDER_PATH;
const root = 'C:/Program Files/Blender Foundation';
const candidates = configured ? [configured] : ['blender', ...(existsSync(root)
  ? readdirSync(root).sort().reverse().map(name => join(root, name, 'blender.exe')) : [])];
const executable = candidates.find(path => spawnSync(path, ['--version'], { encoding: 'utf8', windowsHide: true }).status === 0);
if (!executable) throw new Error('Blender executable not found. Set BLENDER_PATH to your installed Blender executable.');
console.log(spawnSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true }).stdout.split('\n')[0]);
const { MAP_IDS } = await import('../../src/game/maps/mapIds.ts');
for (const id of MAP_IDS) {
  const result = spawnSync(executable, ['--background', '--factory-startup', '--python',
    resolve('scripts/blender/map_assets.py'), '--', resolve('.'), id], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error(`Blender asset generation failed for ${id} (${result.status})`);
}
