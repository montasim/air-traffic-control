import { createGameStore, MemorySavePersistence } from '../../src/storage/gameStore';
import { Simulation } from '../../src/core/Simulation';
import { resolveTrafficProfile } from '../../src/core/trafficProfile';
import { describe, it, expect } from 'vitest';
import { MAP_DEFINITIONS } from '../../src/game/maps/registry';
import { EXPANSION_MAP_IDS, ORIGINAL_MAP_IDS } from '../../src/game/maps/mapIds';
import type { SpecialistLayout } from '../../src/game/maps/shared/specialistAirfield';
import { runwayCorners } from '../../src/game/rendering/shared-map/geometry';
import { trafficProfileById } from '../../src/game/maps/trafficProfiles';
import { applyDifficulty, DIFFICULTIES } from '../../src/core/difficulty';
import { resolveLandingTarget } from '../../src/core/landingTargeting';
import { createDefaultGameSave, migrateGameSave } from '../../src/storage/gameSave';
import { evaluateAchievements } from '../../src/progression/achievements';
import { isMapUnlocked } from '../../src/progression/ranks';

describe('specialist airfields', () => {
  for (const id of EXPANSION_MAP_IDS) for (const [width,height] of [[1600,900],[900,1600],[900,900],[844,390],[640,360]]) {
    it(`${id} keeps all operational surfaces clear at ${width}x${height}`, () => {
      const definition = MAP_DEFINITIONS.find(m => m.id === id)!;
      const layout = definition.prepare({width,height,detailLevel:'mobile'}).layout as SpecialistLayout;
      for(const runway of layout.runways) {
        for(const p of runwayCorners(runway,8,8)) { expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(width);expect(p.y).toBeGreaterThan(height*.12);expect(p.y).toBeLessThan(height); }
        for(const pad of layout.helipads) {
          const dx=pad.center.x-runway.center.x,dy=pad.center.y-runway.center.y;
          const along=Math.abs(dx*Math.cos(runway.angle)+dy*Math.sin(runway.angle));
          const across=Math.abs(-dx*Math.sin(runway.angle)+dy*Math.cos(runway.angle));
          expect(Math.hypot(Math.max(0,along-runway.length/2),Math.max(0,across-runway.width/2))).toBeGreaterThan(pad.radius+8);
        }
      }
      const [first,second]=layout.runways;
      const a=runwayCorners(first,12,12),b=runwayCorners(second,12,12);
      expect([first.angle,second.angle].some(angle=>[angle,angle+Math.PI/2].some(axis=>{
        const aa=a.map(p=>p.x*Math.cos(axis)+p.y*Math.sin(axis)),bb=b.map(p=>p.x*Math.cos(axis)+p.y*Math.sin(axis));
        return Math.max(...aa)<Math.min(...bb)||Math.max(...bb)<Math.min(...aa);
      }))).toBe(true);
      for (const mode of DIFFICULTIES) {
        const traffic=applyDifficulty(trafficProfileById(id),mode);
        for(const {type} of traffic.aircraftTypeWeights) expect(layout.landingZones.some(z=>z.accepts===type)).toBe(true);
      }
      expect(layout.guidanceSurfaces).toHaveLength(layout.landingZones.length);
      for(const pad of layout.helipads) {
        const result=resolveLandingTarget({aircraftType:'rotor',aircraftCollisionRadius:17,points:[{x:pad.center.x-80,y:pad.center.y},pad.center],zones:layout.landingZones,pointerPrecision:'coarse'});
        expect(result.status).toBe('locked'); if(result.status==='locked') expect(result.zoneId).toBe(pad.zoneId);
      }
      for(const building of layout.buildings) for(const runway of layout.runways) {
        const dy=building.center.y-runway.center.y,dx=building.center.x-runway.center.x;
        const across=Math.abs(-dx*Math.sin(runway.angle)+dy*Math.cos(runway.angle));
        expect(across).toBeGreaterThan(runway.width/2+building.height/2);
      }
    });
  }
  for (const id of EXPANSION_MAP_IDS) for (const mode of DIFFICULTIES) for (const [width,height] of [[1600,900],[900,1600]]) {
    it(`${id} completes every landing destination on ${mode} at ${width}x${height}`, () => {
      const map = MAP_DEFINITIONS.find(m => m.id === id)!;
      const layout = map.prepare({width,height,detailLevel:'desktop'}).layout;
      for (const zone of layout.landingZones) {
        const profile = resolveTrafficProfile({ ...applyDifficulty(trafficProfileById(id), mode), openingSpawns:[{at:0,type:zone.accepts}], spawnIntervalStages:[{at:0,interval:999}] });
        const simulation = new Simulation(layout.landingZones,{width,height},profile);
        simulation.start(73);
        const plane=simulation.snapshot().aircraft[0];
        plane.position={x:zone.position.x-Math.cos(zone.angle)*100,y:zone.position.y-Math.sin(zone.angle)*100};
        plane.heading=zone.angle; plane.hasEntered=true; plane.state='flying';
        expect(simulation.assignRoute(plane.id,[{...plane.position},{...zone.position}],zone.id).accepted).toBe(true);
        for(let i=0;i<600 && simulation.snapshot().score===0;i++) simulation.update(1/60);
        expect(simulation.snapshot().score).toBe(1);
        expect(simulation.drainEvents()).toContainEqual({type:'landed',aircraftId:plane.id,aircraftType:zone.accepts,score:1});
      }
    });
  }
  it('preserves original Explorer and evaluates new-five collection separately', () => {
    const save=createDefaultGameSave();
    for(const id of EXPANSION_MAP_IDS) Object.assign(save.mapRecords[id],{safeLandings:1});
    const awards=evaluateAchievements(save,1).newIds;
    expect(awards).toContain('expanded-horizons');expect(awards).not.toContain('airfield-explorer');
    for(const id of ORIGINAL_MAP_IDS) Object.assign(save.mapRecords[id],{safeLandings:1});
    expect(evaluateAchievements(save,1).newIds).toContain('airfield-explorer');
  });
  it('extends existing V3 saves without replacing records or sound settings', () => {
    const original=createDefaultGameSave();
    const oldRecords=Object.fromEntries(ORIGINAL_MAP_IDS.map(id=>[id,original.mapRecords[id]]));
    const migrated=migrateGameSave({...original,mapRecords:oldRecords,selectedDifficulty:'hard',settings:{audio:{enabled:false,volume:.35}}});
    expect(migrated.selectedDifficulty).toBe('hard');expect(migrated.settings.audio.volume).toBe(.35);
    for(const id of EXPANSION_MAP_IDS) {expect(migrated.mapRecords[id].safeLandings).toBe(0);expect(isMapUnlocked(id,'chief-controller')).toBe(true);expect(isMapUnlocked(id,'control-trainee')).toBe(false);}
  });
  it('records every new map and difficulty without losing sound preferences', async () => {
    const defaults=createDefaultGameSave();
    const store=createGameStore(new MemorySavePersistence({...defaults,career:{...defaults.career,earnedRankId:'chief-controller',acknowledgedRankId:'chief-controller'},settings:{audio:{enabled:false,volume:.35}}}));
    for(const id of EXPANSION_MAP_IDS) {
      await store.selectMap(id);
      for(const difficulty of DIFFICULTIES) for(const orientation of ['portrait','landscape'] as const) {
        await store.selectDifficulty(difficulty);
        await store.recordShift({runId:`${id}-${difficulty}-${orientation}`,mapId:id,difficulty,orientation,score:1,safeLandings:1,evidence:{landedTypes:{liner:1,commuter:0,rotor:0},initialSafeLandings:1}});
      }
    }
    const save=await store.load();
    expect(save.settings.audio).toEqual({enabled:false,volume:.35});
    expect(save.career.totalSafeLandings).toBe(30);
    expect(save.achievements['expanded-horizons']).toBeDefined();
    expect(save.achievements['airfield-explorer']).toBeUndefined();
    for(const id of EXPANSION_MAP_IDS) for(const mode of DIFFICULTIES) expect(save.mapRecords[id].difficultyScores[mode]).toEqual({portrait:1,landscape:1});
  });
  it('rejects missing traffic profiles',()=>expect(()=>trafficProfileById('missing')).toThrow());
});
