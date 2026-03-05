import { GameEngine } from "./GameEngine";
import type { GameSnapshot } from "./types";
import { ROOM_STATES, type RoomContract, type SessionId } from "../session/types";

export const GAME_MANAGER_ERRORS = {
  GAME_ALREADY_EXISTS: "game_already_exists",
  GAME_NOT_FOUND: "game_not_found",
  ROOM_NOT_ACTIVE: "room_not_active",
  ROOM_MISSING_PLAYERS: "room_missing_players",
} as const;

export type GameManagerErrorCode =
  (typeof GAME_MANAGER_ERRORS)[keyof typeof GAME_MANAGER_ERRORS];

interface GameManagerSuccess<T> {
  ok: true;
  data: T;
}

interface GameManagerFailure {
  ok: false;
  error: GameManagerErrorCode;
  message: string;
}

export type GameManagerResult<T> = GameManagerSuccess<T> | GameManagerFailure;

export interface CreateGameOutput {
  snapshot: GameSnapshot;
}

export interface CloseGameOutput {
  removed: boolean;
}

export class GameManager {
  private readonly gamesBySession = new Map<SessionId, GameEngine>();

  createGameForRoom(room: RoomContract): GameManagerResult<CreateGameOutput> {
    if (room.state !== ROOM_STATES.ACTIVE) {
      return this.fail(
        GAME_MANAGER_ERRORS.ROOM_NOT_ACTIVE,
        `Room '${room.sessionId}' is not active`,
      );
    }

    if (!room.seats.white || !room.seats.black) {
      return this.fail(
        GAME_MANAGER_ERRORS.ROOM_MISSING_PLAYERS,
        `Room '${room.sessionId}' must have both white and black players`,
      );
    }

    if (this.gamesBySession.has(room.sessionId)) {
      return this.fail(
        GAME_MANAGER_ERRORS.GAME_ALREADY_EXISTS,
        `Game already exists for room '${room.sessionId}'`,
      );
    }

    const game = GameEngine.create({
      gameId: this.generateGameId(room.sessionId),
      sessionId: room.sessionId,
      players: {
        white: room.seats.white,
        black: room.seats.black,
      },
    });
    this.gamesBySession.set(room.sessionId, game);

    return this.ok({
      snapshot: game.snapshot(),
    });
  }

  getGame(sessionId: SessionId): GameEngine | null {
    return this.gamesBySession.get(sessionId) ?? null;
  }

  requireGame(sessionId: SessionId): GameManagerResult<GameEngine> {
    const game = this.getGame(sessionId);
    if (!game) {
      return this.fail(
        GAME_MANAGER_ERRORS.GAME_NOT_FOUND,
        `No game exists for room '${sessionId}'`,
      );
    }
    return this.ok(game);
  }

  closeGameForRoom(sessionId: SessionId): GameManagerResult<CloseGameOutput> {
    const existed = this.gamesBySession.delete(sessionId);
    return this.ok({ removed: existed });
  }

  closeGame(sessionId: SessionId): GameManagerResult<CloseGameOutput> {
    return this.closeGameForRoom(sessionId);
  }

  private generateGameId(sessionId: SessionId): string {
    return `${sessionId}:${Date.now()}`;
  }

  private ok<T>(data: T): GameManagerSuccess<T> {
    return { ok: true, data };
  }

  private fail(error: GameManagerErrorCode, message: string): GameManagerFailure {
    return { ok: false, error, message };
  }
}
