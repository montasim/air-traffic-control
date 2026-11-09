import * as THREE from 'three';
import * as Art from './CanvasScene';
import { VectorArtwork } from './VectorArtwork';
import { SpriteBatch } from './SpriteBatch';
import {SpriteAtlas,type AtlasRegion} from './SpriteAtlas';

interface Entry { node:THREE.Group; mesh?:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>; vector?:VectorArtwork; revision:number; raster?:HTMLCanvasElement; texture?:THREE.Texture; }

/** Keeps original painted assets as textures; Three.js owns all live transforms and drawing. */
export class ThreeArtwork {
  readonly group=new THREE.Group();
  private readonly entries=new Map<Art.GameObject,Entry>();
  private readonly textures=new Map<Art.Texture,THREE.Texture>();
  private readonly batches:SpriteBatch[]=[];
  private readonly atlas=new SpriteAtlas();
  private readonly inverse=new THREE.Matrix4();
  constructor(readonly source:Art.Scene,private readonly density=1) {}
  private texture(source:Art.Texture){
    let texture=this.textures.get(source);
    if(!texture){texture=new THREE.Texture(source.image);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;this.textures.set(source,texture);}
    return texture;
  }
  sync(){
    const live=new Set<Art.GameObject>();let order=0;
    const sprites:{mesh:NonNullable<Entry['mesh']>;u:number;v:number;region?:AtlasRegion}[]=[];
    const runs:{start:number;end:number;order:number}[]=[];
    let previousTexture:THREE.Texture|undefined,previousBlend:THREE.Blending|undefined;
    const visit=(object:Art.GameObject,parent:THREE.Group,alpha:number,visible:boolean)=>{
      live.add(object);
      let entry=this.entries.get(object);
      if(!entry){entry={node:new THREE.Group(),revision:-1};this.entries.set(object,entry);}
      if(entry.node.parent!==parent)parent.add(entry.node);
      const node=entry.node;node.position.set(object.x,object.y,0);node.rotation.z=object.rotation;node.scale.set(object.scaleX,object.scaleY,1);node.visible=visible&&object.visible;
      if(object instanceof Art.Container){for(const child of object.list)visit(child,node,alpha*object.alpha,node.visible);return;}
      // Invisible lights, selection rings, and empty feedback must not allocate/upload artwork.
      if(!node.visible||alpha*object.alpha<=0){node.visible=false;return;}
      if(object instanceof Art.Graphics&&object.vectorRendering){
        if(!entry.vector){entry.vector=new VectorArtwork();node.add(entry.vector.mesh);}
        if(entry.revision!==object.revision){entry.vector.update(object);entry.revision=object.revision;}
        entry.vector.mesh.visible=entry.vector.geometry.drawRange.count>0;
        entry.vector.material.opacity=alpha*object.alpha;entry.vector.material.color.setHex(object.tint);
        entry.vector.mesh.renderOrder=order++;previousTexture=undefined;return;
      }
      let texture:THREE.Texture,width=1,height=1,x=0,y=0;
      let region:AtlasRegion|undefined;
      if(object instanceof Art.Graphics){
        const bounds=object.bounds;
        const density=Math.min(this.density,4096/Math.max(bounds.width,bounds.height));
        if(entry.revision!==object.revision){
          const raster=entry.raster??Art.canvas(1,1);entry.raster=raster;
          const rasterWidth=Math.max(1,Math.ceil(bounds.width*density));
          const rasterHeight=Math.max(1,Math.ceil(bounds.height*density));
          // GPU texture storage is immutable after upload. A growing or shrinking
          // route needs new storage, not an upload into the previous dimensions.
          if(entry.texture&&(raster.width!==rasterWidth||raster.height!==rasterHeight)){
            entry.texture.dispose();entry.texture=undefined;
          }
          raster.width=rasterWidth;raster.height=rasterHeight;
          const context=raster.getContext('2d')!;context.scale(density,density);context.translate(-bounds.x,-bounds.y);object.paint(context);
          if(!entry.texture){entry.texture=new THREE.CanvasTexture(raster);entry.texture.colorSpace=THREE.SRGBColorSpace;entry.texture.generateMipmaps=false;entry.texture.minFilter=THREE.LinearFilter;}
          entry.texture.needsUpdate=true;entry.revision=object.revision;
        }
        texture=entry.texture!;width=bounds.width;height=bounds.height;x=bounds.x+width/2;y=bounds.y+height/2;
      }else if(object instanceof Art.Image){
        region=object instanceof Art.TileSprite?undefined:this.atlas.get(object.texture);
        texture=region?.texture??this.texture(object.texture);width=object.width;height=object.height;x=(.5-object.originX)*width;y=(.5-object.originY)*height;
        if(object instanceof Art.TileSprite){
          texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
        }
      }else return;
      if(!entry.mesh){
        const geometry=new THREE.PlaneGeometry(1,1),uv=geometry.getAttribute('uv');
        const tile=object instanceof Art.TileSprite;
        const sx=tile?object.width/object.texture.image.width:1,sy=tile?object.height/object.texture.image.height:1;
        for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*sx,1-uv.getY(i)*sy);
        entry.mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,transparent:true,premultipliedAlpha:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));node.add(entry.mesh);
      }
      const mesh=entry.mesh;mesh.material.map=texture;mesh.material.opacity=alpha*object.alpha;mesh.material.color.setHex(object.tint);
      mesh.material.blending=object.blendMode===1?THREE.AdditiveBlending:object.blendMode===2?THREE.MultiplyBlending:THREE.NormalBlending;
      mesh.position.set(x,y,0);mesh.scale.set(width,height,1);mesh.renderOrder=order++;
      mesh.visible=false; // Render through an ordered shared buffer, not one draw per sprite.
      if(previousTexture!==texture||previousBlend!==mesh.material.blending){runs.push({start:sprites.length,end:sprites.length,order:mesh.renderOrder});}
      sprites.push({mesh,region,u:object instanceof Art.TileSprite?object.tilePositionX/object.texture.image.width:0,
        v:object instanceof Art.TileSprite?-object.tilePositionY/object.texture.image.height:0});
      runs[runs.length-1].end=sprites.length;previousTexture=texture;previousBlend=mesh.material.blending;
    };
    this.source.children.depthSort();
    for(const object of this.source.children.list)visit(object,this.group,1,true);
    this.group.updateWorldMatrix(true,true);this.inverse.copy(this.group.matrixWorld).invert();
    for(let i=0;i<runs.length;i++){
      const run=runs[i],first=sprites[run.start].mesh;
      let batch=this.batches[i];if(!batch){batch=new SpriteBatch();this.batches.push(batch);this.group.add(batch.mesh);}
      batch.begin(first.material.map!,first.material.blending,run.order);batch.reserve(run.end-run.start);
      for(let j=run.start;j<run.end;j++){const s=sprites[j];batch.add(s.mesh,this.inverse,s.u,s.v,s.region);}batch.finish();
    }
    for(let i=runs.length;i<this.batches.length;i++)this.batches[i].mesh.visible=false;
    for(const [object,entry] of this.entries)if(!live.has(object)){
      entry.node.removeFromParent();entry.mesh?.geometry.dispose();entry.mesh?.material.dispose();entry.texture?.dispose();entry.vector?.dispose();
      if(entry.raster)entry.raster.width=entry.raster.height=0;this.entries.delete(object);
    }
  }
  memoryBytes(){
    let bytes=this.atlas.memoryBytes();
    for(const source of this.textures.keys())bytes+=source.image.width*source.image.height*4;
    for(const entry of this.entries.values())if(entry.raster)bytes+=entry.raster.width*entry.raster.height*4;
    for(const batch of this.batches)for(const attribute of Object.values(batch.geometry.attributes))bytes+=attribute.array.byteLength;
    for(const entry of this.entries.values())if(entry.vector)for(const attribute of Object.values(entry.vector.geometry.attributes))bytes+=attribute.array.byteLength;
    return bytes;
  }
  dispose(){
    for(const batch of this.batches)batch.dispose();this.batches.length=0;
    this.atlas.dispose();
    for(const entry of this.entries.values()){entry.mesh?.geometry.dispose();entry.mesh?.material.dispose();entry.texture?.dispose();entry.vector?.dispose();if(entry.raster)entry.raster.width=entry.raster.height=0;}
    for(const texture of this.textures.values())texture.dispose();this.entries.clear();this.textures.clear();this.group.clear();
  }
}
