import type Phaser from 'phaser';
import type { WorldDetailLevel } from '../../palette';

export interface CivilMapPalette {
  readonly terrain: number;
  readonly terrainLight: number;
  readonly terrainDark: number;
  readonly fieldLine: number;
  readonly water: number;
  readonly waterEdge: number;
  readonly waterShallow: number;
  readonly airportGround: number;
  readonly asphalt: number;
  readonly asphaltEdge: number;
  readonly apron: number;
  readonly marking: number;
  readonly taxiwayMarking: number;
  readonly building: number;
  readonly buildingRoof: number;
  readonly shadow: number;
  readonly vegetation: number;
  readonly vegetationLight: number;
}

export interface StaticMapPaintContext<Layout> {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly layout: Layout;
  readonly detailLevel: WorldDetailLevel;
  readonly unit: number;
}

export type StaticMapPainter<Layout> = (context: StaticMapPaintContext<Layout>) => void;

export interface StaticMapComposeOptions {
  readonly depth?: number;
}

export interface MapDetailBudget {
  readonly fieldLines: number;
  readonly trees: number;
  readonly surfaceWear: number;
  readonly riverSubdivisions: number;
}

export const MAP_DETAIL_BUDGETS: Readonly<Record<WorldDetailLevel, MapDetailBudget>> = {
  mobile: { fieldLines: 8, trees: 12, surfaceWear: 8, riverSubdivisions: 5 },
  tablet: { fieldLines: 14, trees: 22, surfaceWear: 14, riverSubdivisions: 8 },
  desktop: { fieldLines: 22, trees: 34, surfaceWear: 22, riverSubdivisions: 12 }
};

