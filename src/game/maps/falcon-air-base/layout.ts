import { createSpecialistLayout } from '../shared/specialistAirfield';
export function createLayout(width: number, height: number) {
  return createSpecialistLayout(width, height, 'military', {
    landscape: { runways: [[0.67, 0.23, 0.78, -0.08], [0.75, 0.63, 0.61, -0.08]], pads: [[0.54, 0.42]], terminal: [0.72, 0.43] },
    portrait: { runways: [[0.51, 0.25, 0.77, -0.08], [0.55, 0.53, 0.65, 0.1]], pads: [[0.3, 0.69]], terminal: [0.51, 0.39] }
  });
}
