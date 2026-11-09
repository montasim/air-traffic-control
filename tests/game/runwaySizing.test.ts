import {describe,it,expect} from 'vitest';
import {MAP_DEFINITIONS, mapDefinitionById} from '../../src/game/maps/registry';
import type {MapRunway} from '../../src/game/maps/shared/airfield';
import {createCarrier, type Carrier} from '../../src/game/maps/shared/carrier';
import {runwayCorners} from '../../src/game/rendering/shared-map/geometry';
import {pointInPolygon} from '../../src/game/maps/shared/apronLayout';

describe('consistent runway widths',()=>{
 for(const [width,height] of [[1600,900],[900,1600],[900,900]])for(const twoEndLanding of [false,true]){
  it(`matches Saltmarsh by aircraft type at ${width}x${height}, two ends ${twoEndLanding}`,()=>{
   const input={width,height,twoEndLanding,detailLevel:'desktop' as const};
   const reference=mapDefinitionById('saltmarsh-gateway').prepare(input).layout as unknown as {runways:MapRunway[]};
   for(const definition of MAP_DEFINITIONS){
    const layout=definition.prepare(input).layout as ReturnType<typeof definition.prepare>['layout'] & {runways:MapRunway[];carrier?:Carrier};
    for(const runway of layout.runways){
     expect(runway.width,`${definition.id}/${runway.id}`).toBe(reference.runways.find(r=>r.accepts===runway.accepts)!.width);
     for(const guide of layout.guidanceSurfaces.filter(s=>s.kind==='runway'&&s.runwayId===runway.id)){
      if(guide.kind==='runway'){expect(guide.width).toBe(runway.width);expect(guide.length).toBe(runway.length);}
     }
    }
    if(layout.carrier){
     const carrier=layout.carrier;
     // Widening a runway must not turn its ship into a broad floating platform.
     expect(carrier.beam / carrier.length).toBeLessThanOrEqual(.4);
     for(const lane of carrier.runways){
      expect(carrier.paintedLanes[0].width).toBe(lane.width);
      for(const corner of runwayCorners(lane,Math.max(2,lane.width*.08),Math.max(2,lane.width*.08)))
       expect(pointInPolygon(corner,carrier.deck),`${definition.id}: lane shoulder stays on deck`).toBe(true);
     }
     const previous=createCarrier({id:carrier.id,center:carrier.center,length:carrier.length,angle:carrier.angle,pads:carrier.helipads.length as 1|2,padRadius:30,taxiwayWidth:10});
     expect(carrier.runways[0].length).toBe(previous.runways[0].length);
    }
   }
  });
 }
 it('keeps Executive Point runway lengths authored',()=>{
  for(const [width,height,main,commuter] of [[1600,900,.66,.52],[900,1600,.7,.61],[900,900,.7,.61]]){
   const layout=mapDefinitionById('executive-point').prepare({width,height,detailLevel:'desktop'}).layout as unknown as {runways:MapRunway[]};
   expect(layout.runways.map(r=>r.length)).toEqual([main*Math.min(width,height),commuter*Math.min(width,height)]);
  }
 });
});
