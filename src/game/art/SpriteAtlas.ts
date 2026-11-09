import * as THREE from 'three';
import {canvas,type Texture} from './CanvasScene';
export interface AtlasRegion {texture:THREE.Texture;u:number;v:number;width:number;height:number;}
type Page={image:HTMLCanvasElement;texture:THREE.CanvasTexture;x:number;y:number;row:number;};
type Slot={page:Page;x:number;y:number;width:number;height:number;revision:number;region:AtlasRegion;};

/** Bounded, scene-owned pages for original small sprites. No repacking during animation. */
export class SpriteAtlas {
  private readonly pages:Page[]=[];
  private readonly slots=new WeakMap<Texture,Slot>();
  private readonly size=512;
  get(source:Texture):AtlasRegion|undefined {
    const {width,height}=source.image;
    if(width>256||height>256||!width||!height)return;
    let slot=this.slots.get(source);
    if(slot&&(slot.width!==width||slot.height!==height))return;
    if(!slot){
      let page=this.pages.find(p=>this.fits(p,width+4,height+4));
      if(!page){
        if(this.pages.length>=4)return;
        const image=canvas(this.size,this.size),texture=new THREE.CanvasTexture(image);
        texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
        page={image,texture,x:0,y:0,row:0};this.pages.push(page);
      }
      if(page.x+width+4>this.size){page.x=0;page.y+=page.row;page.row=0;}
      const x=page.x+2,y=page.y+2;page.x+=width+4;page.row=Math.max(page.row,height+4);
      slot={page,x,y,width,height,revision:-1,region:{texture:page.texture,u:x/this.size,v:1-(y+height)/this.size,width:width/this.size,height:height/this.size}};
      this.slots.set(source,slot);
    }
    if(slot.revision!==source.revision){
      const {page,x,y}=slot,c=page.image.getContext('2d')!;
      c.clearRect(x-2,y-2,width+4,height+4);c.drawImage(source.image,x,y);
      // Extruded edges preserve each sprite's clamp-to-edge filtering inside the page.
      c.drawImage(source.image,0,0,width,1,x,y-2,width,2);c.drawImage(source.image,0,height-1,width,1,x,y+height,width,2);
      c.drawImage(source.image,0,0,1,height,x-2,y,2,height);c.drawImage(source.image,width-1,0,1,height,x+width,y,2,height);
      for(const [sx,sy,dx,dy] of [[0,0,x-2,y-2],[width-1,0,x+width,y-2],[0,height-1,x-2,y+height],[width-1,height-1,x+width,y+height]])c.drawImage(source.image,sx,sy,1,1,dx,dy,2,2);
      slot.revision=source.revision;page.texture.needsUpdate=true;
    }
    return slot.region;
  }
  private fits(p:Page,w:number,h:number){return p.x+w<=this.size?p.y+h<=this.size:p.y+p.row+h<=this.size;}
  memoryBytes(){return this.pages.length*this.size*this.size*4;}
  dispose(){for(const p of this.pages){p.texture.dispose();p.image.width=p.image.height=0;}this.pages.length=0;}
}
