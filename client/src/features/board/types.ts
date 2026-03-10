export type BoardOrientation = "white" | "black";
export type PlayerColor = "white" | "black";
export type PromotionPiece = "q" | "r" | "b" | "n";

export type GameStatus = "active" | "finished";

export type GameSnapshot = {
  fen: string;
  turn: PlayerColor;
  moveCount: number;
  status: GameStatus;
};

export type MoveIntent = {
  from: string;
  to: string;
  promotion?: PromotionPiece;
};
