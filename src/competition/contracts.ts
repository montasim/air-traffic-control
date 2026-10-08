import type { DifficultyId } from '../core/difficulty';
import type { GameOverReason } from '../core/types';
import type { MapId } from '../game/maps/mapIds';
import type { ChallengeOrientation } from './rules';
import type { RouteCommand } from './verifyRun';

export interface PublicChallenge {
  readonly id: string;
  readonly slug: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly mapId: MapId;
  readonly difficulty: DifficultyId;
  readonly twoEndLanding: boolean;
  readonly ruleset: string;
  readonly seed: number;
}

export interface Standing {
  readonly rank: number;
  readonly callsign: string;
  readonly score: number;
  readonly isPlayer: boolean;
}

export interface ChallengeResponse {
  readonly challenge: PublicChallenge | null;
  readonly serverTime: string;
  readonly standings: Record<ChallengeOrientation, readonly Standing[]>;
}

export interface ChallengeIdentity {
  readonly playerId: string;
  readonly callsign: string;
  readonly credential: string;
}

export interface StartChallengeRequest {
  readonly challengeId: string;
  readonly orientation: ChallengeOrientation;
  readonly requestId: string;
}

export interface StartChallengeResponse {
  readonly runId: string;
  readonly expiresAt: string;
  readonly challenge: PublicChallenge;
  readonly player: { readonly id: string; readonly callsign: string };
}

export interface SubmitChallengeRequest {
  readonly runId: string;
  readonly commands: readonly RouteCommand[];
}

export interface SubmitChallengeResponse {
  readonly status: 'verified';
  readonly score: number;
  readonly reason: GameOverReason;
  readonly endTick: number;
  readonly rank: number;
  readonly personalBest: number | null;
  readonly improved: boolean;
  readonly feedbackRequested: boolean;
  readonly standings: readonly Standing[];
}

export type FairnessAnswer = 'agree' | 'unsure' | 'disagree';
export type FairnessFactor = 'same-rules' | 'device-controls' | 'pausing' | 'suspicious-scores' | 'connection-verification';

export interface ChallengeFeedbackRequest {
  readonly challengeId: string;
  readonly fairness: FairnessAnswer;
  readonly factor: FairnessFactor;
}
