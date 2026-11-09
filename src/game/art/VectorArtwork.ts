import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import type { Graphics } from './CanvasScene';
const cap=Array.from({length:9},(_,i)=>({x:Math.cos(Math.PI/2+i*Math.PI/8),y:Math.sin(Math.PI/2+i*Math.PI/8)}));
const littleEndian=new Uint8Array(new Uint32Array([1]).buffer)[0]===1;

/** Live feedback uses triangles, never a world-sized canvas upload. Static art stays baked. */
export class VectorArtwork {
  readonly geometry = new THREE.BufferGeometry();
  readonly material = new THREE.MeshBasicMaterial({vertexColors:true, transparent:true,
    depthTest:false, depthWrite:false, side:THREE.DoubleSide, toneMapped:false, premultipliedAlpha:true});
  readonly mesh = new THREE.Mesh(this.geometry,this.material);
  private positions:Float32Array<ArrayBufferLike>=new Float32Array(0);
  private colors:Uint8Array<ArrayBufferLike>=new Uint8Array(0);
  private packedColors:Uint32Array<ArrayBufferLike>=new Uint32Array(0);
  private count=0;
  private paths:THREE.Vector2[][]=[];
  private path:THREE.Vector2[]=[];
  private capacity=0;
  private readonly color=new THREE.Color();
  private readonly shades=new Map<string,number>();
  fillStyle='rgba(0,0,0,1)';
  strokeStyle='rgba(0,0,0,1)';
  lineWidth=1;
  lineJoin='round';
  lineCap='round';
  constructor(){this.mesh.frustumCulled=false;}
  private reserve(count:number){
    if(count<=this.capacity)return;
    this.capacity=2**Math.ceil(Math.log2(Math.max(256,count)));
    const positions=new Float32Array(this.capacity*3),colors=new Uint8Array(this.capacity*4);
    positions.set(this.positions);colors.set(this.colors);this.positions=positions;this.colors=colors;this.packedColors=new Uint32Array(colors.buffer);
    this.geometry.dispose();
    this.geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('color',new THREE.BufferAttribute(colors,4,true).setUsage(THREE.DynamicDrawUsage));
  }
  private vertex(x:number,y:number){const i=this.count++*3;this.positions[i]=x;this.positions[i+1]=y;this.positions[i+2]=0;}
  beginPath(){this.paths=[];this.path=[];}
  moveTo(x:number,y:number){this.path=[new THREE.Vector2(x,y)];this.paths.push(this.path);}
  lineTo(x:number,y:number){if(!this.path.length)this.moveTo(x,y);else this.path.push(new THREE.Vector2(x,y));}
  closePath(){if(this.path.length)this.lineTo(this.path[0].x,this.path[0].y);}
  arc(x:number,y:number,r:number,start:number,end:number,ccw=false){this.ellipse(x,y,r,r,0,start,end,ccw);}
  ellipse(x:number,y:number,rx:number,ry:number,rotation:number,start:number,end:number,ccw=false){
    const tau=Math.PI*2;let sweep=end-start;
    if(!ccw){if(sweep>=tau)sweep=tau;else sweep=((sweep%tau)+tau)%tau;}
    else {if(sweep<=-tau)sweep=-tau;else sweep=-(((-sweep%tau)+tau)%tau);}
    const steps=Math.max(4,Math.ceil(Math.abs(sweep)*Math.sqrt(Math.max(rx,ry)*2)));
    const c=Math.cos(rotation),s=Math.sin(rotation);
    for(let i=0;i<=steps;i++){const a=start+sweep*i/steps,dx=Math.cos(a)*rx,dy=Math.sin(a)*ry;this.lineTo(x+dx*c-dy*s,y+dx*s+dy*c);}
  }
  roundRect(x:number,y:number,w:number,h:number,r:number){
    r=Math.min(r,Math.abs(w)/2,Math.abs(h)/2);this.moveTo(x+r,y);
    this.arc(x+w-r,y+r,r,-Math.PI/2,0);this.arc(x+w-r,y+h-r,r,0,Math.PI/2);
    this.arc(x+r,y+h-r,r,Math.PI/2,Math.PI);this.arc(x+r,y+r,r,Math.PI,Math.PI*1.5);this.closePath();
  }
  private shade(start:number,style:string){
    let rgba=this.shades.get(style);
    if(rgba===undefined){
      const [r,g,b,a=1]=style.slice(style.indexOf('(')+1,-1).split(',').map(Number);
      this.color.setRGB(r/255,g/255,b/255,THREE.SRGBColorSpace);
      const red=Math.round(this.color.r*255),green=Math.round(this.color.g*255),blue=Math.round(this.color.b*255),alpha=Math.round(Math.max(0,Math.min(1,a))*255);
      rgba=littleEndian?red|(green<<8)|(blue<<16)|(alpha<<24):(red<<24)|(green<<16)|(blue<<8)|alpha;
      if(this.shades.size>=128)this.shades.clear();this.shades.set(style,rgba);
    }
    this.packedColors.fill(rgba,start,this.count);
  }
  private segment(a:THREE.Vector2,b:THREE.Vector2){
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<.001)return;
    const x=dx/length*this.lineWidth/2,y=dy/length*this.lineWidth/2;
    this.reserve(this.count+54);
    this.vertex(a.x-y,a.y+x);this.vertex(b.x-y,b.y+x);this.vertex(a.x+y,a.y-x);
    this.vertex(b.x-y,b.y+x);this.vertex(b.x+y,b.y-x);this.vertex(a.x+y,a.y-x);
    // A segment's rounded caps do not need a general-purpose path triangulator.
    for(const [p,sign] of [[a,1],[b,-1]] as const)for(let i=1;i<cap.length;i++){
      const c=cap[i-1],d=cap[i];
      this.vertex(p.x,p.y);this.vertex(p.x+sign*(c.x*x-c.y*y),p.y+sign*(c.x*y+c.y*x));
      this.vertex(p.x+sign*(d.x*x-d.y*y),p.y+sign*(d.x*y+d.y*x));
    }
  }
  stroke(){
    const start=this.count;
    const style=SVGLoader.getStrokeStyle(this.lineWidth,this.strokeStyle,this.lineJoin,this.lineCap);
    for(const path of this.paths){
      if(path.length===2&&this.lineCap==='round')this.segment(path[0],path[1]);
      else if(path.length>1){
        this.reserve(this.count+path.length*128+256);
        const write=()=>SVGLoader.pointsToStrokeWithBuffers(path,style,8,.001,this.positions as unknown as number[],undefined,undefined,this.count)/3;
        // SVGLoader returns the coordinate count, despite its vertex-count documentation.
        const written=write();
        if(this.count+written>this.capacity){this.reserve(this.count+written);write();}
        this.count+=written;
      }
    }
    this.shade(start,this.strokeStyle);
  }
  fill(){
    const start=this.count;
    for(const path of this.paths){
      const points=path.length>1&&path[0].equals(path[path.length-1])?path.slice(0,-1):path;
      if(points.length<3)continue;
      const faces=THREE.ShapeUtils.triangulateShape(points,[]);this.reserve(this.count+faces.length*3);
      for(const face of faces)for(const i of face)this.vertex(points[i].x,points[i].y);
    }
    this.shade(start,this.fillStyle);
  }
  fillRect(x:number,y:number,w:number,h:number){
    const start=this.count;this.reserve(this.count+6);
    this.vertex(x,y);this.vertex(x+w,y);this.vertex(x,y+h);this.vertex(x+w,y);this.vertex(x+w,y+h);this.vertex(x,y+h);this.shade(start,this.fillStyle);
  }
  update(graphics:Graphics){
    this.count=0;this.beginPath();
    graphics.paint(this as unknown as CanvasRenderingContext2D);
    if(this.count)for(const name of ['position','color']){
      const attribute=this.geometry.getAttribute(name) as THREE.BufferAttribute;
      attribute.clearUpdateRanges();attribute.addUpdateRange(0,this.count*attribute.itemSize);attribute.needsUpdate=true;
    }
    this.geometry.setDrawRange(0,this.count);
  }
  dispose(){this.geometry.dispose();this.material.dispose();}
}
