export type BoardOrientation = "white" | "black";

export type GameStatus = "active" | "finished";

export type GameSnapshot = {
  fen: string;
  turn: "w" | "b";
  moveCount: number;
  status: GameStatus;
};
