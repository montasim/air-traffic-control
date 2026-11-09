import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';

// Repeated Vite builds may leave old hashed chunks on disk. Count only loaded chunks.
export async function loadedBundleBytes(root,results){
 const totals={};
 for(const engine of ['phaser','three']){
  const row=results.find(r=>r.engine===engine);if(!row)continue;
  let raw=0,gzip=0;
  for(const file of new Set(row.raw.resources.map(r=>r.name).filter(name=>name.endsWith('.js')))){
   const data=await readFile(join(root,engine,'dist',file));raw+=data.length;gzip+=gzipSync(data).length;
  }
  totals[engine]={raw,gzip};
 }
 return totals;
}
