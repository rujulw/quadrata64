import type { PlayerId, SessionId } from "../session/types";

export type GameId = string;

export const GAME_STATUSES = {
  NOT_STARTED: "not_started",
  ACTIVE: "active",
  FINISHED: "finished",
} as const;

export type GameStatus = (typeof GAME_STATUSES)[keyof typeof GAME_STATUSES];

export const GAME_PLAYER_COLORS = {
  WHITE: "white",
  BLACK: "black",
} as const;

export type GamePlayerColor =
  (typeof GAME_PLAYER_COLORS)[keyof typeof GAME_PLAYER_COLORS];

export type PromotionPiece = "q" | "r" | "b" | "n";

export interface GameMoveInput {
  from: string;
  to: string;
  promotion?: PromotionPiece;
}

export interface GameResult {
  winnerColor: GamePlayerColor | null;
  reason:
    | "checkmate"
    | "stalemate"
    | "insufficient_material"
    | "threefold_repetition"
    | "fifty_move_rule"
    | "draw"
    | "resign"
    | "timeout"
    | "unknown";
}

export interface GameSnapshot {
  gameId: GameId;
  sessionId: SessionId;
  status: GameStatus;
  fen: string;
  turn: GamePlayerColor;
  moveCount: number;
  players: {
    white: PlayerId;
    black: PlayerId;
  };
  lastMove: GameMoveInput | null;
  result: GameResult | null;
  createdAt: number;
  updatedAt: number;
}
