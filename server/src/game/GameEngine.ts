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
  type TimerState,
  type TimeControlConfig,
  type TimeControlId,
} from "./types";
import type { PlayerId, SessionId } from "../session/types";
import {
  DEFAULT_TIME_CONTROL_ID,
  getTimeControlConfig,
} from "./timeControls";

export interface CreateGameInput {
  gameId: GameId;
  sessionId: SessionId;
  players: {
    white: PlayerId;
    black: PlayerId;
  };
  timeControlId?: TimeControlId;
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
  private readonly timeControl: TimeControlConfig;
  private timer: TimerState;
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
    this.timeControl = getTimeControlConfig(input.timeControlId ?? DEFAULT_TIME_CONTROL_ID);
    this.timer = {
      whiteMs: this.timeControl.initialMs,
      blackMs: this.timeControl.initialMs,
      runningFor: GAME_PLAYER_COLORS.WHITE,
      updatedAt: now,
    };
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
      timeControl: { ...this.timeControl },
      timer: { ...this.timer },
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

    const timedOut = this.consumeActiveTime(Date.now());
    if (timedOut) {
      this.status = GAME_STATUSES.FINISHED;
      this.result = timedOut;
      this.updatedAt = Date.now();
      const snapshot = this.snapshot();
      return this.ok({
        by: input.playerId,
        move: { ...input.move },
        snapshot,
        gameOver: true,
        result: snapshot.result,
      });
    }

    try {
      this.chess.move(input.move);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid move";
      return this.fail(GAME_ENGINE_ERRORS.INVALID_MOVE, message);
    }

    this.drawOfferBy = null;
    this.lastMove = { ...input.move };
    this.applyIncrementFor(playerColor);
    this.timer.runningFor = this.mapTurn(this.chess.turn());
    this.timer.updatedAt = Date.now();
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
    this.timer.runningFor = null;
    this.timer.updatedAt = Date.now();
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
    this.timer.runningFor = null;
    this.timer.updatedAt = Date.now();
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

  private consumeActiveTime(now: number): GameResult | null {
    if (this.timer.runningFor === null) {
      this.timer.updatedAt = now;
      return null;
    }

    const elapsedMs = Math.max(0, now - this.timer.updatedAt);
    if (elapsedMs === 0) {
      return null;
    }

    if (this.timer.runningFor === GAME_PLAYER_COLORS.WHITE) {
      this.timer.whiteMs = Math.max(0, this.timer.whiteMs - elapsedMs);
      this.timer.updatedAt = now;
      if (this.timer.whiteMs > 0) return null;
      this.timer.runningFor = null;
      return { winnerColor: GAME_PLAYER_COLORS.BLACK, reason: "timeout" };
    }

    this.timer.blackMs = Math.max(0, this.timer.blackMs - elapsedMs);
    this.timer.updatedAt = now;
    if (this.timer.blackMs > 0) return null;
    this.timer.runningFor = null;
    return { winnerColor: GAME_PLAYER_COLORS.WHITE, reason: "timeout" };
  }

  private applyIncrementFor(playerColor: GamePlayerColor): void {
    if (this.timeControl.incrementMs <= 0) {
      return;
    }

    if (playerColor === GAME_PLAYER_COLORS.WHITE) {
      this.timer.whiteMs += this.timeControl.incrementMs;
      return;
    }

    this.timer.blackMs += this.timeControl.incrementMs;
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
