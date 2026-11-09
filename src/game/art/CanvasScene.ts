import { RuntimeEventBus } from '../runtime/events';

const css=(color:number,alpha=1)=>`rgba(${color>>16&255},${color>>8&255},${color&255},${alpha})`;
export function canvas(width:number,height:number) {
  const image=document.createElement('canvas');image.width=Math.max(1,Math.ceil(width));image.height=Math.max(1,Math.ceil(height));return image;
}
export class Vector2 { constructor(public x:number,public y:number) {} }
type Context=CanvasRenderingContext2D;
export class GameObject {
  x=0;y=0;rotation=0;scaleX=1;scaleY=1;alpha=1;visible=true;depth=0;originX=.5;originY=.5;
  tint=0xffffff;blendMode=0;revision=0;baked=false;
  readonly events=new RuntimeEventBus();
  constructor(public scene:Scene) {}
  setPosition(x:number,y:number){this.x=x;this.y=y;return this;}
  setRotation(angle:number){this.rotation=angle;return this;}
  setScale(x:number,y=x){this.scaleX=x;this.scaleY=y;return this;}
  setAlpha(alpha:number){this.alpha=alpha;return this;}
  setVisible(visible:boolean){this.visible=visible;return this;}
  setDepth(depth:number){this.depth=depth;return this;}
  setOrigin(x:number,y=x){this.originX=x;this.originY=y;return this;}
  setTint(color:number){this.tint=color;return this;}
  clearTint(){return this.setTint(0xffffff);}
  setBlendMode(mode:number){this.blendMode=mode;return this;}
  once(event:string,listener:(...args:any[])=>void){this.events.once(event,listener);return this;}
  destroy(_children=true){if(!this.scene)return;this.events.emit('destroy');this.events.clear();this.scene.remove(this);this.scene=undefined!;}
  paint(_context:Context):void {}
  paintTo(context:Context){
    if(!this.visible||!this.alpha)return;
    context.save();context.translate(this.x,this.y);context.rotate(this.rotation);context.scale(this.scaleX,this.scaleY);
    context.globalAlpha*=this.alpha;
    context.globalCompositeOperation=this.blendMode===1?'lighter':this.blendMode===2?'multiply':'source-over';
    this.paint(context);context.restore();
  }
}

/** Records the original vector artwork. Only rasterization depends on a browser canvas. */
export class Graphics extends GameObject {
  /** Opt-in for frequently changing feedback. Map and aircraft artwork remains rasterized. */
  vectorRendering=false;
  useVectorRendering(){this.vectorRendering=true;return this;}
  private commands:((context:Context)=>void)[]=[];
  private loX=Infinity;private loY=Infinity;private hiX=-Infinity;private hiY=-Infinity;private pad=2;
  private point(x:number,y:number){this.loX=Math.min(this.loX,x);this.loY=Math.min(this.loY,y);this.hiX=Math.max(this.hiX,x);this.hiY=Math.max(this.hiY,y);}
  private command(command:(context:Context)=>void){this.commands.push(command);this.revision++;return this;}
  get bounds(){return Number.isFinite(this.loX)?{x:Math.floor(this.loX-this.pad),y:Math.floor(this.loY-this.pad),width:Math.ceil(this.hiX-this.loX+this.pad*2),height:Math.ceil(this.hiY-this.loY+this.pad*2)}:{x:0,y:0,width:1,height:1};}
  clear(){this.commands=[];this.loX=this.loY=Infinity;this.hiX=this.hiY=-Infinity;this.pad=2;this.revision++;return this;}
  fillStyle(color:number,alpha=1){return this.command(c=>{c.fillStyle=css(color,alpha);});}
  lineStyle(width:number,color:number,alpha=1){this.pad=Math.max(this.pad,width*2);return this.command(c=>{c.lineWidth=width;c.strokeStyle=css(color,alpha);c.lineJoin='round';c.lineCap='round';});}
  beginPath(){return this.command(c=>c.beginPath());}
  closePath(){return this.command(c=>c.closePath());}
  moveTo(x:number,y:number){this.point(x,y);return this.command(c=>c.moveTo(x,y));}
  lineTo(x:number,y:number){this.point(x,y);return this.command(c=>c.lineTo(x,y));}
  fillPath(){return this.command(c=>c.fill());}
  strokePath(){return this.command(c=>c.stroke());}
  fillRect(x:number,y:number,w:number,h:number){this.point(x,y);this.point(x+w,y+h);return this.command(c=>c.fillRect(x,y,w,h));}
  fillRoundedRect(x:number,y:number,w:number,h:number,r:number){this.point(x,y);this.point(x+w,y+h);return this.command(c=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fill();});}
  strokeRoundedRect(x:number,y:number,w:number,h:number,r:number){this.point(x,y);this.point(x+w,y+h);return this.command(c=>{c.beginPath();c.roundRect(x,y,w,h,r);c.stroke();});}
  fillCircle(x:number,y:number,r:number){return this.fillEllipse(x,y,r*2,r*2);}
  fillEllipse(x:number,y:number,w:number,h:number){this.point(x-w/2,y-h/2);this.point(x+w/2,y+h/2);return this.command(c=>{c.beginPath();c.ellipse(x,y,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2);c.fill();});}
  arc(x:number,y:number,r:number,start:number,end:number,anticlockwise=false){this.point(x-r,y-r);this.point(x+r,y+r);return this.command(c=>c.arc(x,y,r,start,end,anticlockwise));}
  strokeCircle(x:number,y:number,r:number){this.point(x-r,y-r);this.point(x+r,y+r);return this.command(c=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke();});}
  lineBetween(x1:number,y1:number,x2:number,y2:number){return this.beginPath().moveTo(x1,y1).lineTo(x2,y2).strokePath();}
  fillTriangle(x1:number,y1:number,x2:number,y2:number,x3:number,y3:number){return this.fillPoints([{x:x1,y:y1},{x:x2,y:y2},{x:x3,y:y3}],true);}
  fillPoints(points:readonly {x:number;y:number}[],close=false){this.beginPath();points.forEach((p,i)=>i?this.lineTo(p.x,p.y):this.moveTo(p.x,p.y));if(close)this.closePath();return this.fillPath();}
  strokePoints(points:readonly {x:number;y:number}[],close=false){this.beginPath();points.forEach((p,i)=>i?this.lineTo(p.x,p.y):this.moveTo(p.x,p.y));if(close)this.closePath();return this.strokePath();}
  paint(context:Context){for(const command of this.commands)command(context);}
}

export class Texture {
  readonly source:{glTexture?:unknown}[]=[{}];
  revision=0;
  constructor(public image:CanvasImageSource&{width:number;height:number},public owned=false){}
  getSourceImage(){return this.image;}
  add(..._args:unknown[]){return this;}
  dispose(){if(this.owned&&this.image instanceof HTMLCanvasElement)this.image.width=this.image.height=0;}
}
class Camera {
  zoom=1;
  setOrigin(..._args:number[]){return this;}
  setZoom(zoom:number){this.zoom=zoom;return this;}
}
export class DynamicTexture extends Texture {
  readonly camera=new Camera();
  declare image:HTMLCanvasElement;
  constructor(width:number,height:number){super(canvas(width,height),true);}
  draw(objects:GameObject|GameObject[]){const c=this.image.getContext('2d')!;c.save();c.scale(this.camera.zoom,this.camera.zoom);for(const item of Array.isArray(objects)?objects:[objects])item.paintTo(c);c.restore();this.revision++;return this;}
  render(){this.revision++;return this;}
}
export class Image extends GameObject {
  width:number;height:number;
  constructor(scene:Scene,public texture:Texture){super(scene);this.width=texture.image.width;this.height=texture.image.height;}
  setTexture(key:string){this.texture=this.scene.textures.get(key);this.width=this.texture.image.width;this.height=this.texture.image.height;this.revision++;return this;}
  setDisplaySize(width:number,height:number){this.scaleX=width/this.width;this.scaleY=height/this.height;return this;}
  paint(c:Context){c.drawImage(this.texture.image,-this.originX*this.width,-this.originY*this.height,this.width,this.height);}
}
export class TileSprite extends Image {
  tilePositionX=0;tilePositionY=0;
  paint(c:Context){
    c.save();c.translate(-this.originX*this.width,-this.originY*this.height);c.beginPath();c.rect(0,0,this.width,this.height);c.clip();
    c.translate(-this.tilePositionX,-this.tilePositionY);c.fillStyle=c.createPattern(this.texture.image,'repeat')!;
    c.fillRect(this.tilePositionX,this.tilePositionY,this.width,this.height);c.restore();
  }
}
export class RenderTexture extends Image {
  declare texture:DynamicTexture;
  get camera(){return this.texture.camera;}
  draw(objects:GameObject|GameObject[]){this.texture.draw(objects);this.revision++;return this;}
  render(){this.texture.render();this.revision++;return this;}
  destroy(){super.destroy();this.texture.dispose();}
}
export class Container extends GameObject {
  constructor(scene:Scene,public list:GameObject[]){super(scene);for(const item of list)scene.remove(item);}
  paint(c:Context){for(const child of this.list)child.paintTo(c);}
  destroy(_children=true){for(const child of this.list)child.destroy();this.list=[];super.destroy();}
}
export class Arc extends Graphics {
  constructor(scene:Scene,private radius:number,private fill:number,private fillAlpha:number){super(scene);this.fillStyle(fill,fillAlpha).fillCircle(0,0,radius);}
  setStrokeStyle(width:number,color:number,alpha=1){this.clear().fillStyle(this.fill,this.fillAlpha).fillCircle(0,0,this.radius).lineStyle(width,color,alpha).strokeCircle(0,0,this.radius);return this;}
}
export class Rectangle extends Graphics {}
export class Text extends Image {
  setResolution(_resolution:number){return this;}
}
export class Scene {
  readonly events=new RuntimeEventBus();
  readonly registry=new Map<string,unknown>();
  readonly cameras={main:new Camera()};
  readonly sys={renderer:undefined};
  readonly game:{canvas:{width:number;height:number;clientWidth?:number;clientHeight?:number}};
  readonly scale:{gameSize:{width:number;height:number}};
  readonly children={list:[] as GameObject[],depthSort:()=>this.children.list.sort((a,b)=>a.depth-b.depth)};
  private sources=new Map<string,Texture>();
  readonly textures={
    exists:(key:string)=>this.sources.has(key),
    get:(key:string)=>{const t=this.sources.get(key);if(!t)throw new Error(`Missing original artwork texture: ${key}`);return t;},
    create:(key:string,source:CanvasImageSource&{width:number;height:number},_width?:number,_height?:number)=>{const t=new Texture(source,true);this.sources.set(key,t);return t;},
    remove:(key:string)=>{this.sources.get(key)?.dispose();this.sources.delete(key);},
    addDynamicTexture:(key:string,width:number,height:number)=>{const t=new DynamicTexture(width,height);this.sources.set(key,t);return t;},
  };
  readonly add={
    graphics:()=>this.insert(new Graphics(this)),
    rectangle:(x:number,y:number,w:number,h:number,color:number)=>this.insert(new Rectangle(this).fillStyle(color).fillRect(0,0,w,h).setPosition(x,y)),
    image:(x:number,y:number,key:string)=>this.insert(new Image(this,this.textures.get(key)).setPosition(x,y)),
    tileSprite:(x:number,y:number,width:number,height:number,key:string)=>{const s=new TileSprite(this,this.textures.get(key));s.width=width;s.height=height;return this.insert(s.setPosition(x,y));},
    renderTexture:(x:number,y:number,width:number,height:number)=>this.insert(new RenderTexture(this,new DynamicTexture(width,height)).setPosition(x,y)),
    container:(x:number,y:number,list:GameObject[])=>this.insert(new Container(this,list).setPosition(x,y)),
    circle:(x:number,y:number,r:number,color:number,alpha=1)=>this.insert(new Arc(this,r,color,alpha).setPosition(x,y)),
    text:(x:number,y:number,text:string,style:Record<string,any>)=>{
      const image=canvas(1,1),c=image.getContext('2d')!,font=`${style.fontStyle??''} ${style.fontSize??'16px'} ${style.fontFamily??'sans-serif'}`;
      c.font=font;const px=style.padding?.x??0,py=style.padding?.y??0;
      image.width=Math.ceil(c.measureText(text).width+px*2);image.height=Math.ceil(parseFloat(style.fontSize??'16')*1.3+py*2);
      if(style.backgroundColor){c.fillStyle=style.backgroundColor;c.fillRect(0,0,image.width,image.height);}
      c.font=font;c.textBaseline='top';c.fillStyle=style.color??'#fff';c.fillText(text,px,py);
      return this.insert(new Text(this,new Texture(image,true)).setPosition(x,y));
    },
  };
  readonly make={graphics:({x=0,y=0}: {x?:number;y?:number},_add=false)=>new Graphics(this).setPosition(x,y)};
  constructor(width:number,height:number,scale=1){this.scale={gameSize:{width,height}};this.game={canvas:{width:Math.ceil(width*scale),height:Math.ceil(height*scale)}};this.cameras.main.zoom=scale;}
  insert<T extends GameObject>(object:T){this.children.list.push(object);return object;}
  remove(object:GameObject){const i=this.children.list.indexOf(object);if(i>=0)this.children.list.splice(i,1);}
  destroy(){this.events.emit('shutdown');for(const child of [...this.children.list])child.destroy();for(const texture of this.sources.values())texture.dispose();this.sources.clear();this.events.clear();}
}
