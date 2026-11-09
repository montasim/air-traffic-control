import * as THREE from 'three';
import type { MapId } from '../maps/mapIds';
import { validateAtlasPng, MAX_ATLAS_FILE_BYTES } from './atlasContract';

export async function loadAtlas(mapId: MapId, signal?: AbortSignal) {
  const response=await fetch(`/assets/three/${mapId}/atlas.png`,{signal});
  if(!response.ok)throw new Error(`Blender atlas for ${mapId} failed to load (${response.status})`);
  if(Number(response.headers.get('content-length')??0)>MAX_ATLAS_FILE_BYTES) {
    await response.body?.cancel();throw new Error('Blender atlas exceeds file budget');
  }
  const bytes=await response.arrayBuffer();validateAtlasPng(bytes);
  const image=await createImageBitmap(new Blob([bytes],{type:'image/png'}),{imageOrientation:'flipY',premultiplyAlpha:'none'});
  const texture=new THREE.Texture(image);
  texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return {image,texture,dispose(){texture.dispose();image.close();}};
}
