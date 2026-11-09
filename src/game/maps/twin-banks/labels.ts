import type { TwinBanksLayout } from './layout';
import type { AirfieldSign } from '../shared/airfield';
export function visibleTwinBanksLabels(layout: TwinBanksLayout): readonly AirfieldSign[] {
  return layout.detailBudget.showLabels ? layout.signs : [];
}

export function eastBankPolygon(layout: TwinBanksLayout): readonly { x: number; y: number }[] {
  return [
    ...layout.river.centerline,
    { x: layout.width, y: layout.height },
    { x: layout.width, y: 0 }
  ];
}
