import * as THREE from 'three';
import type {AtlasRegion} from './SpriteAtlas';

/** Adjacent sprites only: transparent painting order is never changed to save draws. */
export class SpriteBatch {
  readonly geometry=new THREE.BufferGeometry();
  readonly material=new THREE.MeshBasicMaterial({transparent:true,vertexColors:true,premultipliedAlpha:true,
    depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
  readonly mesh=new THREE.Mesh(this.geometry,this.material);
  private capacity=0;
  private count=0;
  private readonly position=new THREE.Vector3();
  private readonly matrix=new THREE.Matrix4();
  constructor(){this.mesh.frustumCulled=false;}
  begin(texture:THREE.Texture,blending:THREE.Blending,order:number){
    this.count=0;this.material.map=texture;this.material.blending=blending;
    this.mesh.renderOrder=order;this.mesh.visible=true;
  }
  reserve(sprites:number){
    if(sprites<=this.capacity)return;
    this.capacity=2**Math.ceil(Math.log2(Math.max(16,sprites)));
    this.geometry.dispose();
    for(const [name,size] of [['position',3],['uv',2],['color',4]] as const)
      this.geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(this.capacity*6*size),size).setUsage(THREE.DynamicDrawUsage));
  }
  add(source:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>,inverse:THREE.Matrix4,u=0,v=0,region?:AtlasRegion){
    const positions=this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const uv=this.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const colors=this.geometry.getAttribute('color') as THREE.BufferAttribute;
    const vertices=source.geometry.getAttribute('position'),sourceUV=source.geometry.getAttribute('uv'),indices=source.geometry.index!;
    this.matrix.multiplyMatrices(inverse,source.matrixWorld);
    const color=source.material.color;
    for(let i=0;i<6;i++){
      const index=indices.getX(i),target=this.count*6+i;
      this.position.fromBufferAttribute(vertices,index).applyMatrix4(this.matrix);
      positions.setXYZ(target,this.position.x,this.position.y,this.position.z);
      uv.setXY(target,region?region.u+sourceUV.getX(index)*region.width:sourceUV.getX(index)+u,
        region?region.v+sourceUV.getY(index)*region.height:sourceUV.getY(index)+v);
      colors.setXYZW(target,color.r,color.g,color.b,source.material.opacity);
    }
    this.count++;
  }
  finish(){
    for(const name of ['position','uv','color']){
      const a=this.geometry.getAttribute(name) as THREE.BufferAttribute;
      a.clearUpdateRanges();a.addUpdateRange(0,this.count*6*a.itemSize);a.needsUpdate=true;
    }
    this.geometry.setDrawRange(0,this.count*6);
  }
  dispose(){this.geometry.dispose();this.material.dispose();}
}
