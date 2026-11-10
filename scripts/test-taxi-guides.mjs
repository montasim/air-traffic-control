import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge'});
try {
 const page=await browser.newPage();
 await page.goto(new URL('scripts/menu-pictures.html',process.env.RESIZE_TEST_URL||'http://127.0.0.1:5173/').href);
 const results=await page.evaluate(async()=>{
  const {MAP_DEFINITIONS}=await import('/src/game/maps/registry.ts');
  const {taxiGuidePaths}=await import('/src/game/maps/shared/groundRoutes.ts');
  const {paintAirfieldGuides}=await import('/src/game/rendering/shared-map/apronPainter.ts');
  const {SALTMARSH_GATEWAY_PALETTE:palette}=await import('/src/game/maps/saltmarsh-gateway/palette.ts');
  const {Scene}=await import('/src/game/art/CanvasScene.ts');
  const results=[];
  for(const map of MAP_DEFINITIONS)for(const [width,height]of [[1600,900],[900,1600],[900,900],[430,932]]){
   const layout=map.prepare({width,height,twoEndLanding:true,detailLevel:'desktop'}).layout;
   const source=new Scene(width,height),graphics=source.add.graphics();
   paintAirfieldGuides(graphics,layout,palette,'desktop');
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d');graphics.paint(ctx);
   for(const runway of layout.runways){
    const zones=layout.landingZones.filter(z=>z.approach?.runwayId===runway.id);
    if(!zones.length)continue;
    const oneWay=layout.guidanceSurfaces.some(s=>s.kind==='runway'&&s.runwayId===runway.id&&s.oneWay);
    const guides=taxiGuidePaths({...layout,landingZones:zones});
    const visible=guides.every(path=>{const a=path[0],b=path[1],x=Math.round((a.x+b.x)/2),y=Math.round((a.y+b.y)/2);return ctx.getImageData(x-1,y-1,3,3).data.some((v,i)=>i%4===3&&v>0);});
    const distinct=new Set(guides.map(p=>p[0].x.toFixed(2)+','+p[0].y.toFixed(2))).size;
    results.push({map:map.id,runway:runway.id,width,height,expected:oneWay?1:2,count:guides.length,distinct,visible});
   }
   source.destroy();
  }
  return results;
 });
 for(const r of results){assert.equal(r.count,r.expected,JSON.stringify(r));assert.equal(r.distinct,r.expected,JSON.stringify(r));assert.ok(r.visible,JSON.stringify(r));}
 console.log('Passed '+results.length+' runway/viewport checks: two distinct painted connectors on every two-way runway; one on one-way carrier lanes.');
}finally{await browser.close();}
