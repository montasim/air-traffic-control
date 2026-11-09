import * as THREE from 'three';
import { mapDefinitionById } from '../game/maps/registry';
import type { MapId } from '../game/maps/mapIds';
import type { WorldDetailLevel } from '../game/palette';
import { MapWorld } from '../game/three/MapWorld';

import { MemoryLedger } from '../game/runtime/diagnostics';
import { shrink, airfieldFocus } from './previewImage';
export { shrink, airfieldFocus } from './previewImage';

export interface PreviewSettings {
  readonly night: boolean;
  readonly weather: boolean;
  readonly twoEndLanding: boolean;
  readonly world: { readonly width: number; readonly height: number };
  readonly detailLevel: WorldDetailLevel;
}

/** One temporary context, one map at a time, using the gameplay compositor. */
export function createMapPreviews(
  onPreview: (id: MapId, url: string, focus: { readonly x: number; readonly y: number }) => void,
  options: PreviewSettings & { readonly maps: readonly MapId[]; readonly onDone?: () => void },
): () => void {
  const abort=new AbortController();
  let stopped=false;
  const renderer=new THREE.WebGLRenderer({antialias:true,depth:false,stencil:false});
  const {width,height}=options.world;
  const scale=Math.min(1,1440/Math.max(width,height));
  renderer.setSize(Math.round(width*scale),Math.round(height*scale),false);
  const camera=new THREE.OrthographicCamera(0,width,0,height,.1,100);camera.position.z=10;
  const cleanup=()=>{if(stopped)return;stopped=true;abort.abort();renderer.dispose();renderer.forceContextLoss();renderer.domElement.width=renderer.domElement.height=0;};
  void (async()=>{
    try {
      for(const id of options.maps) {
        if(stopped)break;
        let world:MapWorld|undefined;
        try {
          const prepared=mapDefinitionById(id).prepare({...options.world,detailLevel:options.detailLevel,twoEndLanding:options.twoEndLanding});
          world=new MapWorld(id,prepared.layout,new MemoryLedger(),'classic',options.detailLevel,options.night,scale);
          world.setNight(options.night);world.setWeather(options.weather);world.sync();
          const scene=new THREE.Scene();scene.add(world.group);
          renderer.render(scene,camera);
          onPreview(id,shrink(renderer.domElement,width,height),airfieldFocus(prepared.layout.landingZones,width,height));
        } finally {world?.dispose();}
        await new Promise<void>(resolve=>setTimeout(resolve,0));
        if(stopped)break;
      }
    } catch(error) {if(!stopped)console.error('Map preview failed',error);}
    finally {if(!stopped){cleanup();options.onDone?.();}}
  })();
  return cleanup;
}
