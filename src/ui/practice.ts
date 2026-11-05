import { AIRCRAFT_OUTLINES } from '../core/aircraftCollision';

const SVG_NS = 'http://www.w3.org/2000/svg';
type Lesson = 'land' | 'hold';
const LESSON_TITLE: Record<Lesson, string> = { land: 'Land an aircraft', hold: 'Hold, then land' };
const LESSON_COPY: Record<Lesson, string> = {
  land: 'Draw the aircraft to its runway.',
  hold: 'Tap the drifting aircraft to make it circle, then draw it to the runway.',
};
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
  // Two lessons, chosen on the page: draw an aircraft to its runway, or hold a drifting one and then draw it in.
  let lesson: Lesson = 'land', origin = { ...start }, holding = false, idle = 0, demoTimers: number[] = [];
  const lessonCopy = document.querySelector<HTMLElement>('#practice-lesson-copy')!;
  // The faint ring a held aircraft flies around, as in a shift.
  const holdRing = document.querySelector<SVGCircleElement>('#practice-hold')!;
  const holdRadius = Number(holdRing.getAttribute('r'));
  const lessonTitle = document.querySelector<HTMLElement>('#practice-lesson-title')!;
  paintPlane(plane);
  const position = (p: Point, angle = -18) => { origin = { ...p }; plane.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`); };
  const draw = () => route.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  /** Drifts the aircraft toward the edge until tapped, then circles it in place. */
  function startHoldLesson(message = 'Tap the aircraft to make it circle.'): void {
    holding = false;
    flying = false;
    plane.style.opacity = '1';
    status.textContent = message;
    const drift = { x: 60, y: 250 };
    let last = performance.now(), turn = 0, centre = drift;
    position(drift, 0);
    const tick = (now: number) => {
      // Stops while the practice page is hidden, so nothing animates in the background.
      if (field.closest('[hidden]')) return;
      const step = Math.max(0, now - last) / 1000;
      last = now;
      if (holding) {
        if (turn === 0) {
          centre = { x: origin.x, y: origin.y - holdRadius };
          holdRing.setAttribute('cx', String(centre.x));
          holdRing.setAttribute('cy', String(centre.y));
          holdRing.removeAttribute('display');
        }
        turn += step * 1.6;
        position({ x: centre.x + Math.sin(turn) * holdRadius, y: centre.y + Math.cos(turn) * holdRadius }, -turn * 180 / Math.PI);
      } else {
        position({ x: origin.x + step * 38, y: origin.y }, 0);
        if (origin.x > 580) { startHoldLesson('It left the field. Tap the aircraft sooner.'); return; }
      }
      idle = requestAnimationFrame(tick);
    };
    idle = requestAnimationFrame(tick);
  }
  function reset(): void {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(idle);
    demoTimers.forEach(clearTimeout);
    demoTimers = [];
    holding = false;
    holdRing.setAttribute('display', 'none');
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
    lessonTitle.textContent = LESSON_TITLE[lesson];
    lessonCopy.textContent = LESSON_COPY[lesson];
    if (lesson === 'hold') startHoldLesson();
  }
  function fly(): void {
    cancelAnimationFrame(idle);
    holdRing.setAttribute('display', 'none');
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
        points = [];
        draw();
        if (lesson === 'land') {
          status.textContent = 'Safe landing! Try the Hold lesson next, or go back.';
        } else {
          status.textContent = 'Held and landed. You’re ready to guide traffic. Try again, or go back.';
        }
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
    if (flying || pointer !== undefined || distance(point(event), origin) > 46) return;
    pointer = event.pointerId;
    field.setPointerCapture(pointer);
    points = [{ ...origin }];
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
    if (index >= 0) { points.push(ends[index]); draw(); fly(); return; }
    points = [];
    draw();
    // A tap, not a drag, holds the drifting aircraft, as in a shift.
    if (lesson === 'hold' && !holding && distance(p, origin) <= 46) {
      holding = true;
      status.textContent = 'Holding. Now draw it to the runway.';
    } else if (lesson === 'hold') {
      status.textContent = holding ? 'Draw from the circling aircraft to a landing circle.' : 'Tap the aircraft to make it circle.';
    } else { reset(); status.textContent = 'Finish your route in a highlighted landing circle. Try again.'; }
  });
  const choices = document.querySelectorAll<HTMLInputElement>('input[name="practice-lesson"]');
  const choose = (next: Lesson) => {
    lesson = next;
    choices.forEach(input => { input.checked = input.value === next; });
    reset();
  };
  choices.forEach(input => input.addEventListener('change', () => choose(input.value as Lesson)));
  field.addEventListener('pointercancel', reset);
  document.querySelector('#practice-reset')!.addEventListener('click', reset);
  document.querySelector('#practice-demo')!.addEventListener('click', () => {
    reset();
    if (lesson === 'land') { points = [start, { x: 200, y: 215 }, { x: 280, y: 110 }, ends[0]]; draw(); fly(); return; }
    // Hold shows only the new skill, a tap that starts the circle; the landing is left to the player.
    demoTimers.push(window.setTimeout(() => { holding = true; status.textContent = 'That’s a hold. Now draw it to the runway yourself.'; }, 900));
  });
  reset();
  return reset;
}
