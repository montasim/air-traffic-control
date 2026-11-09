import {describe,it,expect} from 'vitest';
import {Scene} from '../../src/game/art/CanvasScene';
import {VectorArtwork} from '../../src/game/art/VectorArtwork';

describe('live vector feedback buffers',()=>{
 it('keeps GPU storage stable as a route shrinks, and removes cleared routes',()=>{
  const g=new Scene(900,1600).add.graphics();const view=new VectorArtwork();
  g.lineStyle(3,0xffaa33,.5).strokePoints([{x:0,y:0},{x:100,y:50},{x:200,y:0}]);view.update(g);
  const positions=view.geometry.getAttribute('position'),colors=view.geometry.getAttribute('color');
  expect(view.geometry.drawRange.count).toBeGreaterThan(0);
  expect(Math.abs(colors.getW(0)-.5)).toBeLessThan(1/255);
  g.clear().lineStyle(3,0xffaa33).lineBetween(0,0,5,5);view.update(g);
  expect(view.geometry.getAttribute('position')).toBe(positions);
  expect([...positions.array].every(Number.isFinite)).toBe(true);
  g.clear();view.update(g);expect(view.geometry.drawRange.count).toBe(0);view.dispose();
 });
 it('handles repeated points, holding arcs, and warning fills without invalid vertices',()=>{
  const g=new Scene(900,1600).add.graphics();const view=new VectorArtwork();
  g.lineStyle(4,0xffffff).strokePoints([{x:5,y:5},{x:5,y:5},{x:20,y:10},{x:5,y:5}]);
  g.beginPath().arc(90,90,50,0,-Math.PI,true).strokePath().fillStyle(0xcc5533,.2).fillCircle(90,90,38);
  view.update(g);expect(view.geometry.drawRange.count).toBeGreaterThan(0);
  expect([...view.geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true);view.dispose();
 });
 it('retains the complete end of a long curved route when typed storage grows',()=>{
  const g=new Scene(2000,1000).add.graphics(),view=new VectorArtwork();
  const points=Array.from({length:2048},(_,i)=>({x:i,y:300+Math.sin(i*.03)*40}));
  g.lineStyle(3,0xffaa44,.75).strokePoints(points);view.update(g);
  const count=view.geometry.drawRange.count,positions=view.geometry.getAttribute('position'),colors=view.geometry.getAttribute('color');
  expect(count%3).toBe(0);expect(count).toBeGreaterThan(points.length);
  expect(positions.getX(count-1)).toBeGreaterThan(2040);
  expect(colors.getW(count-1)).toBeGreaterThan(.74);
  expect([...positions.array].every(Number.isFinite)).toBe(true);view.dispose();
 });
 it('keeps an aircraft route unchanged when a distant destination ring is appended',()=>{
  const g=new Scene(1600,1000).add.graphics(),view=new VectorArtwork();
  g.lineStyle(5,0xffaa33).strokePoints([{x:100,y:200},{x:150,y:205},{x:250,y:250}]);
  view.update(g);
  const routeCount=view.geometry.drawRange.count;
  const routeVertices=Array.from(view.geometry.getAttribute('position').array.slice(0,routeCount*3));
  g.lineStyle(2,0xffffff).strokeCircle(1000,700,10);
  view.update(g);
  expect(Array.from(view.geometry.getAttribute('position').array.slice(0,routeCount*3))).toEqual(routeVertices);
  view.dispose();
 });

});
