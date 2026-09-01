import { defineMap } from '../shared/definition';
import { createDesertParallelLayout } from './layout';
import { renderDesertParallelMap } from './renderer';

export * from './layout';

export const DESERT_PARALLEL_DEFINITION = defineMap({
  id: 'desert-parallel',
  metadata: {
    name: 'Desert Parallel',
    description: 'Offset approaches cross a quiet mineral basin beside a remote field station.',
    difficulty: 'advanced',
    unlockRankId: 'control-assistant'
  },
  trafficProfileId: 'desert-parallel',
  createLayout: ({ width, height, detailLevel }) =>
    createDesertParallelLayout(width, height, detailLevel),
  render: (scene, layout, { detailLevel }) =>
    renderDesertParallelMap(scene, layout, detailLevel)
});

/** Compatibility alias for callers that name selectable definitions as maps. */
export const DESERT_PARALLEL_MAP = DESERT_PARALLEL_DEFINITION;
