export type BoardOrientation = "white" | "black";
export type PlayerColor = "white" | "black";
export type PromotionPiece = "q" | "r" | "b" | "n";

export type GameStatus = "active" | "finished";

export type GameResult = {
  winnerColor: PlayerColor | null;
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
};

export type GameSnapshot = {
  fen: string;
  turn: PlayerColor;
  moveCount: number;
  status: GameStatus;
  drawOfferBy: PlayerColor | null;
  lastMove: MoveIntent | null;
  result: GameResult | null;
};

export type MoveIntent = {
  from: string;
  to: string;
  promotion?: PromotionPiece;
};

export type MoveFeedEntry = {
  id: string;
  ply: number;
  by: string;
  notation: string;
};
