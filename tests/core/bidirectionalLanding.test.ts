import { DEFAULT_TRAFFIC_PROFILE } from '../../src/core/trafficProfile';
import { describe, expect, it } from 'vitest';
import { Simulation } from '../../src/core/Simulation';
import { RunwayTraffic, aligned, crossesCapture } from '../../src/core/runwayApproach';
import { resolveLandingTarget } from '../../src/core/landingTargeting';
import type { Aircraft, LandingZone } from '../../src/core/types';
import { MAP_DEFINITIONS } from '../../src/game/maps/registry';
import { ShiftTracker } from '../../src/progression/achievements';

const zones: LandingZone[] = [
  { id:'a',label:'09',accepts:'commuter',position:{x:400,y:400},angle:0,captureRadius:40,color:0,approach:{runwayId:'strip',end:0} },
  { id:'b',label:'27',accepts:'commuter',position:{x:800,y:400},angle:Math.PI,captureRadius:40,color:0,approach:{runwayId:'strip',end:1} }
];
function plane(id: number, x: number, heading = 0): Aircraft {
  return {id,type:'commuter',position:{x,y:400},heading,speed:50,collisionRadius:18,state:'flying',hasEntered:true,landingProgress:0};
}
const previous = (planes: Aircraft[]) => new Map(planes.map(p => [p.id,{...p.position}]));
function frames(simulation: Simulation, count: number) { for(let i=0;i<count;i++) simulation.update(1/60); }

describe('runway approach and reservation', () => {
  it('accepts aligned outside entries with angle wrapping and swept capture, not sideways or from inside', () => {
    expect(aligned(Math.PI*2,zones[0])).toBe(true);
    expect(aligned(Math.PI/6,zones[0])).toBe(true);
    expect(aligned(Math.PI/6+.01,zones[0])).toBe(false);
    expect(crossesCapture({x:300,y:400},plane(1,500),zones[0])).toBe(true);
    expect(crossesCapture({x:405,y:400},plane(1,406),zones[0])).toBe(false);
    expect(crossesCapture({x:350,y:400},plane(1,365,Math.PI/2),zones[0])).toBe(false);
  });
  it('arbitrates both ends deterministically and releases on reroute, departure, removal and reset', () => {
    const traffic = new RunwayTraffic();
    const a=plane(2,350), b=plane(1,850,Math.PI);
    traffic.update([a,b],zones,previous([a,b]));
    expect(traffic.reservations.get('strip')?.aircraftId).toBe(1);
    expect(traffic.warnings).toContainEqual({aircraftId:2,zoneId:'a',reason:'busy'});
    b.approachZoneId='a';
    traffic.update([b,a],zones,previous([b,a]));
    expect(traffic.reservations.get('strip')?.aircraftId).toBe(2);
    a.position.x=100;
    traffic.update([a],zones,previous([a]));
    expect(traffic.reservations.size).toBe(0);
    a.position.x=350;
    traffic.update([a],zones,previous([a]));
    traffic.update([],zones,new Map());
    expect(traffic.reservations.size).toBe(0);
    traffic.update([a],zones,previous([a]));
    traffic.clear();
    expect(traffic.reservations.size).toBe(0);
  });
  it('holds ownership through landing and allows independent strips', () => {
    const traffic=new RunwayTraffic(), a=plane(1,350), b=plane(2,850,Math.PI);
    traffic.update([a],zones,previous([a]));
    a.state='landing'; a.position.x=400;
    traffic.update([b,a],zones,previous([b,a]));
    expect(traffic.reservations.get('strip')?.aircraftId).toBe(1);
    const other={...zones[1],approach:{runwayId:'other',end:1 as const}};
    traffic.update([a,b],[zones[0],other],previous([a,b]));
    expect(traffic.reservations.size).toBe(2);
  });
  it('chooses the endpoint end over a crossed target for mouse and touch', () => {
    for (const pointerPrecision of ['mouse','coarse'] as const) {
      expect(resolveLandingTarget({aircraftType:'commuter',aircraftCollisionRadius:18,points:[{x:350,y:400},{x:800,y:400}],zones,pointerPrecision,retainedZoneId:'a'})).toMatchObject({status:'locked',zoneId:'b'});
    }
  });
  it('preserves reservation and route through pause, then scores and releases exactly once', () => {
    const sim=new Simulation(zones,{width:1200,height:1000}); sim.start(11);
    const a=sim.snapshot().aircraft[0]; Object.assign(a,plane(a.id,335));
    sim.assignRoute(a.id,[{...a.position},zones[0].position],'a');
    frames(sim,1);
    expect(sim.snapshot().runwayReservations).toHaveLength(1);
    sim.pause(); const frozen=structuredClone(sim.snapshot()); frames(sim,600);
    expect(sim.snapshot()).toEqual(frozen);
    sim.resume(); frames(sim,150);
    expect(sim.snapshot().score).toBe(1);
    expect(sim.snapshot().runwayReservations).toHaveLength(0);
    const tracker=new ShiftTracker(); const events=sim.drainEvents(); events.forEach(e=>tracker.accept(e));
    expect(events.filter(e=>e.type==='landing-started')).toHaveLength(1);
    expect(events.filter(e=>e.type==='landed')).toHaveLength(1);
    expect(tracker.evidence.landedTypes.commuter).toBe(1);
  });
  it('does not switch assigned ends or land from the wrong direction', () => {
    for (const heading of [0,Math.PI/2,Math.PI]) {
      const sim=new Simulation(zones,{width:1200,height:1000}); sim.start(11);
      const p=sim.snapshot().aircraft[0]; Object.assign(p,plane(p.id,380,heading)); p.approachZoneId='b';
      frames(sim,1); expect(p.state).not.toBe('landing');
    }
  });
});

describe('all playable map runway ends', () => {
  for (const map of MAP_DEFINITIONS) {
    for (const [width,height] of [[900,1600],[1600,900],[900,900],[1948,900]]) {
      it(`${map.id} ${width}x${height}: paired targets, inward approaches, and successful landings`, () => {
        const layout=map.prepare({width,height,detailLevel:'desktop'}).layout;
        const ends=layout.landingZones.filter(z=>z.approach);
        expect(ends.length).toBeGreaterThanOrEqual(4);
        const ids=new Set(ends.map(z=>z.approach!.runwayId));
        for(const id of ids) {
          const pair=ends.filter(z=>z.approach!.runwayId===id);
          expect(pair).toHaveLength(2);
          expect(pair[0].accepts).toBe(pair[1].accepts);
          expect(Math.cos(pair[0].angle-pair[1].angle)).toBeCloseTo(-1);
          expect(Math.hypot(pair[0].position.x-pair[1].position.x,pair[0].position.y-pair[1].position.y)).toBeGreaterThan(pair[0].captureRadius+pair[1].captureRadius);
        }
        for(const z of ends) {
          for (const hud of layout.hudExclusionZones) {
            const dx=Math.max(hud.x-z.position.x,0,z.position.x-(hud.x+hud.width));
            const dy=Math.max(hud.y-z.position.y,0,z.position.y-(hud.y+hud.height));
            expect(Math.hypot(dx,dy),`${map.id} ${z.id} clear of ${hud.id}`).toBeGreaterThan(z.captureRadius);
          }
          const outside={x:z.position.x-Math.cos(z.angle)*z.captureRadius*2,y:z.position.y-Math.sin(z.angle)*z.captureRadius*2};
          expect(outside.x).toBeGreaterThanOrEqual(0); expect(outside.x).toBeLessThanOrEqual(width);
          expect(outside.y).toBeGreaterThanOrEqual(0); expect(outside.y).toBeLessThanOrEqual(height);
          const sim=new Simulation(layout.landingZones,{width,height}); sim.start(11);
          const p=sim.snapshot().aircraft[0]; Object.assign(p,{type:z.accepts,position:outside,heading:z.angle,state:'flying',hasEntered:true,speed:100});
          sim.assignRoute(p.id,[outside,z.position],z.id); frames(sim,180);
          expect(sim.snapshot().score).toBe(1);
          expect(sim.drainEvents().filter(e=>e.type==='landing-started')).toEqual([{type:'landing-started',aircraftId:p.id,zoneId:z.id}]);
        }
      });
    }
  }
});

it('blocks a following aircraft on the same runway while keeping it airborne', () => {
  const traffic=new RunwayTraffic();
  const lead=plane(1,355), following=plane(2,330);
  traffic.update([following,lead],zones,previous([following,lead]));
  expect(traffic.reservations.get('strip')?.aircraftId).toBe(lead.id);
  expect(traffic.warnings).toContainEqual({aircraftId:following.id,zoneId:'a',reason:'busy'});
  expect(following.state).toBe('flying');
});

it('releases simulation ownership immediately when a committed route changes', () => {
  const sim=new Simulation(zones,{width:1200,height:1000}); sim.start(11);
  const p=sim.snapshot().aircraft[0]; Object.assign(p,plane(p.id,335));
  sim.assignRoute(p.id,[{...p.position},zones[0].position],'a'); frames(sim,1);
  expect(sim.snapshot().runwayReservations).toHaveLength(1);
  sim.assignRoute(p.id,[{...p.position},{x:200,y:600}]);
  expect(sim.snapshot().runwayReservations).toHaveLength(0);
  frames(sim,1); sim.start(12);
  expect(sim.snapshot().runwayReservations).toHaveLength(0);
});

it('allows only one opposing aircraft to enter landing animation and warns the blocked flight', () => {
  const sim=new Simulation(zones,{width:3000,height:2000},{...DEFAULT_TRAFFIC_PROFILE,openingSpawns:[{at:0,type:'commuter'},{at:.1,type:'commuter'}]}); sim.start(11);
  frames(sim,60);
  const [a,b]=sim.snapshot().aircraft;
  expect(b).toBeDefined();
  Object.assign(a,plane(a.id,380)); Object.assign(b,plane(b.id,820,Math.PI));
  a.approachZoneId='a'; b.approachZoneId='b';
  sim.drainEvents(); frames(sim,1);
  expect([a,b].filter(p=>p.state==='landing')).toHaveLength(1);
  expect(sim.drainEvents()).toContainEqual({type:'approach-warning',aircraftId:b.id,zoneId:'b',reason:'busy'});
  expect(b.state).toBe('flying');
  frames(sim,60);
  expect(sim.snapshot().score).toBe(1);
});
