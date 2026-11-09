import type { DesertParallelLayout } from './layout';
import type { AirfieldSign } from '../shared/airfield';
export function visibleDesertLabels(layout: DesertParallelLayout): readonly AirfieldSign[] {
  return layout.detailBudget.showLabels ? layout.signs : [];
}
