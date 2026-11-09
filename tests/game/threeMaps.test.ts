import { describe, expect, it } from 'vitest';
import { MAP_DEFINITIONS } from '../../src/game/maps/registry';
import { trafficProfileById } from '../../src/game/maps/trafficProfiles';
import { SessionController } from '../../src/game/runtime/SessionController';
import { DEFAULT_COLLISION_SCALES } from '../../src/core/aircraftCollision';
import { Scene } from '../../src/game/art/CanvasScene';

describe.each(MAP_DEFINITIONS)('$id Three.js map', definition => {
  it.each([[1600,900],[900,1950],[1600,1600],[2400,900]])('preserves landing surfaces and saved simulation at %sx%s',(width,height)=>{
    for(const twoEndLanding of [false,true]) {
      const {layout}=definition.prepare({width,height,twoEndLanding,detailLevel:'desktop'});
      expect(layout.landingZones.length).toBeGreaterThan(0);
      for(const surface of layout.guidanceSurfaces) {
        expect(Number.isFinite(surface.center.x)&&Number.isFinite(surface.center.y)).toBe(true);
      }
      const session=new SessionController({zones:layout.landingZones,world:layout,traffic:trafficProfileById(definition.trafficProfileId),collisionScales:DEFAULT_COLLISION_SCALES});
      session.start('medium','test',42);
      session.simulation.pause();const save=session.exportState();
      expect(session.restore('medium',save)).toBe(true);
      expect(session.exportState()).toEqual(save);
    }
  });
});

describe('original artwork recording',()=>{
  it('includes stroked edges in raster bounds and clears old drawing bounds',()=>{
    const scene=new Scene(1600,900);
    const drawing=scene.add.graphics().lineStyle(6,0xffffff).lineBetween(-20,-10,40,50);
    expect(drawing.bounds).toEqual({x:-32,y:-22,width:84,height:84});
    const revision=drawing.revision;
    drawing.clear().fillCircle(0,0,5);
    expect(drawing.bounds).toEqual({x:-7,y:-7,width:14,height:14});
    expect(drawing.revision).toBeGreaterThan(revision);
  });
  it('keeps aircraft children out of root painting and releases scene listeners',()=>{
    const scene=new Scene(1600,900),body=scene.add.graphics(),shadow=scene.add.graphics();
    const aircraft=scene.add.container(20,30,[shadow,body]);
    expect(scene.children.list).toEqual([aircraft]);
    let shutdowns=0;scene.events.once('shutdown',()=>shutdowns++);
    scene.destroy();scene.destroy();
    expect(shutdowns).toBe(1);expect(scene.children.list).toEqual([]);
  });
});
