import { Chess } from "chess.js";

import {
  GAME_PLAYER_COLORS,
  GAME_STATUSES,
  type GameId,
  type GameMoveInput,
  type GamePlayerColor,
  type GameResult,
  type GameStatus,
  type GameSnapshot,
} from "./types";
import type { PlayerId, SessionId } from "../session/types";

export interface CreateGameInput {
  gameId: GameId;
  sessionId: SessionId;
  players: {
    white: PlayerId;
    black: PlayerId;
  };
}

export interface ApplyMoveInput {
  playerId: PlayerId;
  move: GameMoveInput;
}

export const GAME_ENGINE_ERRORS = {
  GAME_NOT_ACTIVE: "game_not_active",
  PLAYER_NOT_IN_GAME: "player_not_in_game",
  NOT_PLAYER_TURN: "not_player_turn",
  INVALID_MOVE_INPUT: "invalid_move_input",
  INVALID_MOVE: "invalid_move",
  DRAW_ALREADY_OFFERED: "draw_already_offered",
  DRAW_NOT_OFFERED: "draw_not_offered",
  DRAW_CANNOT_ACCEPT_OWN_OFFER: "draw_cannot_accept_own_offer",
  DRAW_CANNOT_DECLINE_OWN_OFFER: "draw_cannot_decline_own_offer",
} as const;

export type GameEngineErrorCode =
  (typeof GAME_ENGINE_ERRORS)[keyof typeof GAME_ENGINE_ERRORS];

interface GameEngineFailure {
  ok: false;
  error: GameEngineErrorCode;
  message: string;
}

interface GameEngineSuccess<T> {
  ok: true;
  data: T;
}

export type GameEngineResult<T> = GameEngineSuccess<T> | GameEngineFailure;

export interface MoveApplied {
  by: PlayerId;
  move: GameMoveInput;
  snapshot: GameSnapshot;
  gameOver: boolean;
  result: GameResult | null;
}

export interface DrawOffered {
  by: GamePlayerColor;
  snapshot: GameSnapshot;
}

export interface DrawDeclined {
  by: GamePlayerColor;
  snapshot: GameSnapshot;
}

export interface GameConcluded {
  by: PlayerId;
  snapshot: GameSnapshot;
  result: GameResult;
}

export class GameEngine {
  static create(input: CreateGameInput): GameEngine {
    return new GameEngine(input);
  }

  private readonly gameId: GameId;
  private readonly sessionId: SessionId;
  private readonly players: {
    white: PlayerId;
    black: PlayerId;
  };
  private readonly chess: Chess;
  private status: GameStatus = GAME_STATUSES.ACTIVE;
  private drawOfferBy: GamePlayerColor | null = null;
  private lastMove: GameMoveInput | null = null;
  private result: GameResult | null = null;
  private readonly createdAt: number;
  private updatedAt: number;

  private constructor(input: CreateGameInput) {
    const now = Date.now();
    this.gameId = input.gameId;
    this.sessionId = input.sessionId;
    this.players = { ...input.players };
    this.chess = new Chess();
    this.createdAt = now;
    this.updatedAt = now;
  }

  snapshot(): GameSnapshot {
    return {
      gameId: this.gameId,
      sessionId: this.sessionId,
      status: this.status,
      fen: this.chess.fen(),
      turn: this.mapTurn(this.chess.turn()),
      moveCount: this.chess.history().length,
      players: { ...this.players },
      drawOfferBy: this.drawOfferBy,
      lastMove: this.lastMove ? { ...this.lastMove } : null,
      result: this.result ? { ...this.result } : null,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  applyMove(input: ApplyMoveInput): GameEngineResult<MoveApplied> {
    if (this.status !== GAME_STATUSES.ACTIVE) {
      return this.fail(
        GAME_ENGINE_ERRORS.GAME_NOT_ACTIVE,
        "Game is not active",
      );
    }

    const playerColor = this.getPlayerColor(input.playerId);
    if (!playerColor) {
      return this.fail(
        GAME_ENGINE_ERRORS.PLAYER_NOT_IN_GAME,
        `Player '${input.playerId}' is not in this game`,
      );
    }

    if (playerColor !== this.mapTurn(this.chess.turn())) {
      return this.fail(
        GAME_ENGINE_ERRORS.NOT_PLAYER_TURN,
        `It is not '${input.playerId}' turn`,
      );
    }

    if (!isMoveInput(input.move)) {
      return this.fail(
        GAME_ENGINE_ERRORS.INVALID_MOVE_INPUT,
        "Move must include non-empty 'from' and 'to' squares",
      );
    }

    try {
      this.chess.move(input.move);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid move";
      return this.fail(GAME_ENGINE_ERRORS.INVALID_MOVE, message);
    }

    this.drawOfferBy = null;
    this.lastMove = { ...input.move };
    this.updatedAt = Date.now();

    if (this.chess.isGameOver()) {
      this.status = GAME_STATUSES.FINISHED;
      this.result = this.deriveGameResult();
    }

    const snapshot = this.snapshot();
    return this.ok({
      by: input.playerId,
      move: { ...input.move },
      snapshot,
      gameOver: snapshot.status === GAME_STATUSES.FINISHED,
      result: snapshot.result,
    });
  }

  getPlayerColor(playerId: PlayerId): GamePlayerColor | null {
    if (playerId === this.players.white) {
      return GAME_PLAYER_COLORS.WHITE;
    }
    if (playerId === this.players.black) {
      return GAME_PLAYER_COLORS.BLACK;
    }
    return null;
  }

  offerDraw(playerId: PlayerId): GameEngineResult<DrawOffered> {
    if (this.status !== GAME_STATUSES.ACTIVE) {
      return this.fail(
        GAME_ENGINE_ERRORS.GAME_NOT_ACTIVE,
        "Game is not active",
      );
    }

    const playerColor = this.getPlayerColor(playerId);
    if (!playerColor) {
      return this.fail(
        GAME_ENGINE_ERRORS.PLAYER_NOT_IN_GAME,
        `Player '${playerId}' is not in this game`,
      );
    }

    if (this.drawOfferBy) {
      return this.fail(
        GAME_ENGINE_ERRORS.DRAW_ALREADY_OFFERED,
        "A draw offer is already pending",
      );
    }

    this.drawOfferBy = playerColor;
    this.updatedAt = Date.now();

    return this.ok({
      by: playerColor,
      snapshot: this.snapshot(),
    });
  }

  acceptDraw(playerId: PlayerId): GameEngineResult<GameConcluded> {
    if (this.status !== GAME_STATUSES.ACTIVE) {
      return this.fail(
        GAME_ENGINE_ERRORS.GAME_NOT_ACTIVE,
        "Game is not active",
      );
    }

    const playerColor = this.getPlayerColor(playerId);
    if (!playerColor) {
      return this.fail(
        GAME_ENGINE_ERRORS.PLAYER_NOT_IN_GAME,
        `Player '${playerId}' is not in this game`,
      );
    }

    if (!this.drawOfferBy) {
      return this.fail(
        GAME_ENGINE_ERRORS.DRAW_NOT_OFFERED,
        "No draw offer is currently pending",
      );
    }

    if (this.drawOfferBy === playerColor) {
      return this.fail(
        GAME_ENGINE_ERRORS.DRAW_CANNOT_ACCEPT_OWN_OFFER,
        "Player cannot accept their own draw offer",
      );
    }

    this.drawOfferBy = null;
    this.status = GAME_STATUSES.FINISHED;
    this.result = { winnerColor: null, reason: "draw" };
    this.updatedAt = Date.now();

    const snapshot = this.snapshot();
    return this.ok({
      by: playerId,
      snapshot,
      result: snapshot.result as GameResult,
    });
  }

  declineDraw(playerId: PlayerId): GameEngineResult<DrawDeclined> {
    if (this.status !== GAME_STATUSES.ACTIVE) {
      return this.fail(
        GAME_ENGINE_ERRORS.GAME_NOT_ACTIVE,
        "Game is not active",
      );
    }

    const playerColor = this.getPlayerColor(playerId);
    if (!playerColor) {
      return this.fail(
        GAME_ENGINE_ERRORS.PLAYER_NOT_IN_GAME,
        `Player '${playerId}' is not in this game`,
      );
    }

    if (!this.drawOfferBy) {
      return this.fail(
        GAME_ENGINE_ERRORS.DRAW_NOT_OFFERED,
        "No draw offer is currently pending",
      );
    }

    if (this.drawOfferBy === playerColor) {
      return this.fail(
        GAME_ENGINE_ERRORS.DRAW_CANNOT_DECLINE_OWN_OFFER,
        "Player cannot decline their own draw offer",
      );
    }

    this.drawOfferBy = null;
    this.updatedAt = Date.now();
    return this.ok({
      by: playerColor,
      snapshot: this.snapshot(),
    });
  }

  resign(playerId: PlayerId): GameEngineResult<GameConcluded> {
    if (this.status !== GAME_STATUSES.ACTIVE) {
      return this.fail(
        GAME_ENGINE_ERRORS.GAME_NOT_ACTIVE,
        "Game is not active",
      );
    }

    const playerColor = this.getPlayerColor(playerId);
    if (!playerColor) {
      return this.fail(
        GAME_ENGINE_ERRORS.PLAYER_NOT_IN_GAME,
        `Player '${playerId}' is not in this game`,
      );
    }

    const winnerColor =
      playerColor === GAME_PLAYER_COLORS.WHITE
        ? GAME_PLAYER_COLORS.BLACK
        : GAME_PLAYER_COLORS.WHITE;

    this.drawOfferBy = null;
    this.status = GAME_STATUSES.FINISHED;
    this.result = { winnerColor, reason: "resign" };
    this.updatedAt = Date.now();

    const snapshot = this.snapshot();
    return this.ok({
      by: playerId,
      snapshot,
      result: snapshot.result as GameResult,
    });
  }

  private deriveGameResult(): GameResult {
    if (this.chess.isCheckmate()) {
      const winnerColor =
        this.chess.turn() === "w"
          ? GAME_PLAYER_COLORS.BLACK
          : GAME_PLAYER_COLORS.WHITE;
      return {
        winnerColor,
        reason: "checkmate",
      };
    }

    if (this.chess.isStalemate()) {
      return { winnerColor: null, reason: "stalemate" };
    }

    if (this.chess.isInsufficientMaterial()) {
      return { winnerColor: null, reason: "insufficient_material" };
    }

    if (this.chess.isThreefoldRepetition()) {
      return { winnerColor: null, reason: "threefold_repetition" };
    }

    if (this.chess.isDrawByFiftyMoves()) {
      return { winnerColor: null, reason: "fifty_move_rule" };
    }

    if (this.chess.isDraw()) {
      return { winnerColor: null, reason: "draw" };
    }

    return { winnerColor: null, reason: "unknown" };
  }

  private mapTurn(turn: "w" | "b"): GamePlayerColor {
    return turn === "w" ? GAME_PLAYER_COLORS.WHITE : GAME_PLAYER_COLORS.BLACK;
  }

  private ok<T>(data: T): GameEngineSuccess<T> {
    return { ok: true, data };
  }

  private fail(error: GameEngineErrorCode, message: string): GameEngineFailure {
    return { ok: false, error, message };
  }
}

function isMoveInput(value: unknown): value is GameMoveInput {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.from !== "string" || candidate.from.length === 0) {
    return false;
  }
  if (typeof candidate.to !== "string" || candidate.to.length === 0) {
    return false;
  }

  if (
    candidate.promotion !== undefined &&
    candidate.promotion !== "q" &&
    candidate.promotion !== "r" &&
    candidate.promotion !== "b" &&
    candidate.promotion !== "n"
  ) {
    return false;
  }

  return true;
}
