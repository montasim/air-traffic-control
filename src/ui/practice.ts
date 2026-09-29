import { AIRCRAFT_OUTLINES } from '../core/aircraftCollision';

const SVG_NS = 'http://www.w3.org/2000/svg';
type Point = { x: number; y: number };
function paintPlane(group: Element): void {
  const body = document.createElementNS(SVG_NS, 'polygon');
  body.setAttribute('points', AIRCRAFT_OUTLINES.commuter.map(p => p.join(',')).join(' '));
  body.setAttribute('fill', '#fff5df');
  body.setAttribute('stroke', '#173e38');
  body.setAttribute('stroke-width', '2.4');
  const livery = document.createElementNS(SVG_NS, 'path');
  livery.setAttribute('d', 'M-20 0H20');
  livery.setAttribute('stroke', '#f0bd66');
  livery.setAttribute('stroke-width', '7');
  group.replaceChildren(body, livery);
}

/** A self-contained exercise; never touches the live simulation or saved career. */
export function mountPractice(): () => void {
  document.querySelectorAll('[data-help-plane]').forEach(paintPlane);
  const field = document.querySelector<SVGSVGElement>('#practice-field')!;
  const plane = document.querySelector<SVGGElement>('#practice-aircraft')!;
  const route = document.querySelector<SVGPolylineElement>('#practice-route')!;
  const status = document.querySelector<HTMLElement>('#practice-status')!;
  const target = document.querySelector<SVGCircleElement>('#practice-target')!;
  const start = { x: 82, y: 230 }, end = { x: 460, y: 110 };
  let points: Point[] = [], pointer: number | undefined, frame = 0, flying = false;
  paintPlane(plane);
  const position = (p: Point, angle = -18) => plane.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
  const draw = () => route.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  function reset(): void {
    cancelAnimationFrame(frame);
    if (pointer !== undefined && field.hasPointerCapture(pointer)) field.releasePointerCapture(pointer);
    pointer = undefined;
    flying = false;
    points = [];
    draw();
    position(start);
    plane.style.opacity = '1';
    target.setAttribute('stroke', '#f0bd66');
    status.textContent = 'Drag the amber aircraft to the amber runway.';
  }
  function fly(): void {
    flying = true;
    status.textContent = 'Route set. Watch your aircraft follow the line.';
    let segment = 1, last = performance.now();
    let current = { ...points[0] };
    function tick(now: number): void {
      let travel = Math.max(0, now - last) * 0.18;
      last = now;
      while (travel > 0 && segment < points.length) {
        const next = points[segment], remaining = distance(current, next);
        const heading = Math.atan2(next.y - current.y, next.x - current.x) * 180 / Math.PI;
        if (remaining <= travel) { current = { ...next }; travel -= remaining; segment++; }
        else { current.x += (next.x - current.x) * travel / remaining; current.y += (next.y - current.y) * travel / remaining; travel = 0; }
        position(current, heading);
      }
      if (segment < points.length) frame = requestAnimationFrame(tick);
      else {
        plane.style.opacity = '0';
        status.textContent = 'Safe landing! You’re ready to guide traffic. Try again, or go back.';
      }
    }
    frame = requestAnimationFrame(tick);
  }
  function point(event: PointerEvent): Point {
    const matrix = field.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : start;
  }
  field.addEventListener('pointerdown', event => {
    if (flying || pointer !== undefined || distance(point(event), start) > 46) return;
    pointer = event.pointerId;
    field.setPointerCapture(pointer);
    points = [{ ...start }];
    draw();
  });
  field.addEventListener('pointermove', event => {
    if (pointer !== event.pointerId) return;
    const p = point(event);
    if (distance(p, points.at(-1)!) > 4) { points.push(p); draw(); }
    const acquired = distance(p, end) <= 42;
    target.setAttribute('stroke', acquired ? '#fff5df' : '#f0bd66');
    status.textContent = acquired ? 'Runway matched. Release to land.' : 'Keep drawing toward the amber runway.';
  });
  field.addEventListener('pointerup', event => {
    if (pointer !== event.pointerId) return;
    const p = point(event);
    field.releasePointerCapture(pointer);
    pointer = undefined;
    if (distance(p, end) <= 42) { points.push(end); draw(); fly(); }
    else { reset(); status.textContent = 'Finish your line inside the amber landing circle. Try again.'; }
  });
  field.addEventListener('pointercancel', reset);
  document.querySelector('#practice-reset')!.addEventListener('click', reset);
  document.querySelector('#practice-demo')!.addEventListener('click', () => {
    reset(); points = [start, { x: 200, y: 215 }, { x: 320, y: 155 }, end]; draw(); fly();
  });
  reset();
  return reset;
}
