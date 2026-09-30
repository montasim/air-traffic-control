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
export function mountPractice(twoEndLanding: () => boolean = () => false): () => void {
  document.querySelectorAll('[data-help-plane]').forEach(paintPlane);
  const field = document.querySelector<SVGSVGElement>('#practice-field')!;
  const plane = document.querySelector<SVGGElement>('#practice-aircraft')!;
  const route = document.querySelector<SVGPolylineElement>('#practice-route')!;
  const status = document.querySelector<HTMLElement>('#practice-status')!;
  const target = document.querySelector<SVGCircleElement>('#practice-target')!;
  const start = { x: 82, y: 230 };
  const ends = [{ x: 370, y: 110 }, { x: 520, y: 110 }];
  const reverseTarget = document.querySelector<SVGCircleElement>('#practice-target-reverse')!;
  function selectedEnd(p: Point): number { return ends.findIndex((end, index) => (index === 0 || twoEndLanding()) && Math.hypot(p.x-end.x,p.y-end.y) <= 32); }
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
    reverseTarget.setAttribute('stroke', '#f0bd66');
    reverseTarget.style.display = twoEndLanding() ? '' : 'none';
    status.textContent = twoEndLanding() ? 'Draw to either runway end.' : 'Draw to the highlighted runway end.';
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
    if (!matrix) return { ...start };
    const transformed = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    // DOMPoint coordinates are accessors and are lost by object spread in fly().
    return { x: transformed.x, y: transformed.y };
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
    const index = selectedEnd(p);
    const acquired = index >= 0;
    target.setAttribute('stroke', acquired && index === 0 ? '#fff5df' : '#f0bd66');
    reverseTarget.setAttribute('stroke', acquired && index === 1 ? '#fff5df' : '#f0bd66');
    status.textContent = acquired ? 'Runway matched. Release to land.' : (twoEndLanding() ? 'Draw to either landing circle.' : 'Draw to the highlighted landing circle.');
  });
  field.addEventListener('pointerup', event => {
    if (pointer !== event.pointerId) return;
    const p = point(event);
    field.releasePointerCapture(pointer);
    pointer = undefined;
    const index = selectedEnd(p);
    if (index >= 0) { points.push(ends[index]); draw(); fly(); }
    else { reset(); status.textContent = 'Finish your route in a highlighted landing circle. Try again.'; }
  });
  field.addEventListener('pointercancel', reset);
  document.querySelector('#practice-reset')!.addEventListener('click', reset);
  document.querySelector('#practice-demo')!.addEventListener('click', () => {
    reset(); points = [start, { x: 200, y: 215 }, { x: 280, y: 110 }, ends[0]]; draw(); fly();
  });
  reset();
  return reset;
}
