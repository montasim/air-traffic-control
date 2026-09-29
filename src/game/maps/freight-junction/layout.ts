import { createSpecialistLayout } from '../shared/specialistAirfield';
export function createLayout(width: number, height: number) {
  return createSpecialistLayout(width, height, 'cargo', {
    landscape: { runways: [[0.61, 0.25, 0.78, -0.18], [0.77, 0.68, 0.63, 0.18]], pads: [[0.48, 0.64]], terminal: [0.7, 0.46] },
    portrait: { runways: [[0.48, 0.25, 0.76, -0.16], [0.55, 0.56, 0.68, 0.17]], pads: [[0.25, 0.7]], terminal: [0.51, 0.41] }
  });
}
