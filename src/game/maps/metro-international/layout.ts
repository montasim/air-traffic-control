import { createSpecialistLayout } from '../shared/specialistAirfield';
export function createLayout(width: number, height: number) {
  return createSpecialistLayout(width, height, 'passenger', {
    landscape: { runways: [[0.66, 0.22, 0.89, 0], [0.66, 0.68, 0.89, 0]], pads: [[0.86, 0.43]], terminal: [0.66, 0.44] },
    portrait: { runways: [[0.5, 0.22, 0.82, 0], [0.5, 0.54, 0.82, 0]], pads: [[0.74, 0.7]], terminal: [0.5, 0.38] }
  });
}
