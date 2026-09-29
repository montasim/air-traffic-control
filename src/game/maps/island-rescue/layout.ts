import { createSpecialistLayout } from '../shared/specialistAirfield';
export function createLayout(width: number, height: number) {
  return createSpecialistLayout(width, height, 'rescue', {
    landscape: { runways: [[0.69, 0.23, 0.72, 0], [0.69, 0.48, 0.61, 0]], pads: [[0.28, 0.57], [0.68, 0.78]], terminal: [0.69, 0.35] },
    portrait: { runways: [[0.5, 0.23, 0.74, 0], [0.5, 0.41, 0.64, 0]], pads: [[0.24, 0.64], [0.73, 0.77]], terminal: [0.5, 0.32] }
  });
}
