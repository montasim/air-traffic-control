import { createSpecialistLayout } from '../shared/specialistAirfield';
export function createLayout(width: number, height: number) {
  return createSpecialistLayout(width, height, 'business', {
    landscape: { runways: [[0.7, 0.3, 0.66, 0.06], [0.75, 0.57, 0.52, 0.06]], pads: [[0.53, 0.63]], terminal: [0.72, 0.44] },
    portrait: { runways: [[0.48, 0.25, 0.7, 0.04], [0.57, 0.48, 0.61, 0.04]], pads: [[0.32, 0.64]], terminal: [0.5, 0.37] }
  });
}
