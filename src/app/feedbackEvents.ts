export type FeedbackEvent =
  | {
      type: 'route-connected';
      aircraftId: number;
      zoneId: string;
    }
  | {
      type: 'landing-completed';
      aircraftId: number;
      score: number;
    }
  | {
      type: 'collision';
      aircraftIds?: readonly [number, number];
    }
  | {
      type: 'promotion';
      previousRankId: string;
      rankId: string;
    }
  | {
      type: 'ui-confirm';
      action: 'play' | 'resume' | 'map-select';
    };
