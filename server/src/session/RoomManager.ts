import {
  PLAYER_SLOTS,
  ROOM_STATES,
  type PlayerId,
  type PlayerSeat,
  type PlayerSlot,
  type RoomContract,
  type RoomParticipant,
  type SessionId,
} from "./types";

interface RoomManagerOptions {
  maxPlayers?: number;
  maxSpectators?: number;
}

export const ROOM_MANAGER_ERRORS = {
  ROOM_ALREADY_EXISTS: "room_already_exists",
  ROOM_NOT_FOUND: "room_not_found",
  ROOM_CLOSED: "room_closed",
  ROOM_FULL: "room_full",
  SPECTATOR_CAP_REACHED: "spectator_cap_reached",
  PLAYER_ALREADY_IN_ROOM: "player_already_in_room",
  SEAT_TAKEN: "seat_taken",
} as const;

export type RoomManagerErrorCode =
  (typeof ROOM_MANAGER_ERRORS)[keyof typeof ROOM_MANAGER_ERRORS];

interface RoomManagerSuccess<T> {
  ok: true;
  data: T;
}

interface RoomManagerFailure {
  ok: false;
  error: RoomManagerErrorCode;
  message: string;
}

export type RoomManagerResult<T> = RoomManagerSuccess<T> | RoomManagerFailure;

export interface JoinRoomInput {
  sessionId: SessionId;
  playerId: PlayerId;
  requestedSeat?: PlayerSeat;
}

export interface LeaveRoomInput {
  sessionId: SessionId;
  playerId: PlayerId;
}

export interface JoinRoomOutput {
  room: RoomContract;
  participant: RoomParticipant;
}

export interface LeaveRoomOutput {
  roomClosed: boolean;
  room: RoomContract | null;
}

export class RoomManager {
  private readonly rooms = new Map<SessionId, RoomContract>();
  private readonly maxPlayers: number;
  private readonly maxSpectators: number;

  constructor(options: RoomManagerOptions = {}) {
    this.maxPlayers = options.maxPlayers ?? 2;
    this.maxSpectators = options.maxSpectators ?? 0;
  }

  createRoom(sessionId: SessionId): RoomManagerResult<RoomContract> {
    if (this.rooms.has(sessionId)) {
      return this.fail(
        ROOM_MANAGER_ERRORS.ROOM_ALREADY_EXISTS,
        `Room '${sessionId}' already exists`,
      );
    }

    const timestamp = Date.now();
    const room: RoomContract = {
      sessionId,
      state: ROOM_STATES.WAITING,
      seats: {
        white: null,
        black: null,
      },
      spectators: [],
      participants: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.rooms.set(sessionId, room);
    return this.ok(this.cloneRoom(room));
  }

  joinRoom(input: JoinRoomInput): RoomManagerResult<JoinRoomOutput> {
    const room = this.rooms.get(input.sessionId);
    if (!room) {
      return this.fail(
        ROOM_MANAGER_ERRORS.ROOM_NOT_FOUND,
        `Room '${input.sessionId}' does not exist`,
      );
    }

    if (room.state === ROOM_STATES.CLOSED) {
      return this.fail(
        ROOM_MANAGER_ERRORS.ROOM_CLOSED,
        `Room '${input.sessionId}' is closed`,
      );
    }

    const existing = room.participants.find(
      (participant) => participant.playerId === input.playerId,
    );
    if (existing) {
      return this.fail(
        ROOM_MANAGER_ERRORS.PLAYER_ALREADY_IN_ROOM,
        `Player '${input.playerId}' is already in room '${input.sessionId}'`,
      );
    }

    const slotDecision = this.decideSlot(room, input.requestedSeat);
    if (!slotDecision.ok) {
      return slotDecision;
    }

    const slot = slotDecision.data;
    const participant: RoomParticipant = {
      playerId: input.playerId,
      slot,
      ready: false,
      connected: true,
      joinedAt: Date.now(),
    };

    room.participants.push(participant);
    this.assignSlot(room, participant.playerId, slot);
    room.updatedAt = Date.now();

    return this.ok({
      room: this.cloneRoom(room),
      participant: { ...participant },
    });
  }

  leaveRoom(input: LeaveRoomInput): RoomManagerResult<LeaveRoomOutput> {
    const room = this.rooms.get(input.sessionId);
    if (!room) {
      return this.fail(
        ROOM_MANAGER_ERRORS.ROOM_NOT_FOUND,
        `Room '${input.sessionId}' does not exist`,
      );
    }

    const existingIndex = room.participants.findIndex(
      (participant) => participant.playerId === input.playerId,
    );
    if (existingIndex === -1) {
      return this.ok({
        roomClosed: false,
        room: this.cloneRoom(room),
      });
    }

    const existing = room.participants[existingIndex];
    room.participants.splice(existingIndex, 1);
    this.unassignSlot(room, existing.playerId, existing.slot);
    room.updatedAt = Date.now();

    if (room.participants.length === 0) {
      this.closeRoomInternal(room.sessionId);
      return this.ok({
        roomClosed: true,
        room: null,
      });
    }

    return this.ok({
      roomClosed: false,
      room: this.cloneRoom(room),
    });
  }

  closeRoom(sessionId: SessionId): RoomManagerResult<RoomContract> {
    const room = this.rooms.get(sessionId);
    if (!room) {
      return this.fail(
        ROOM_MANAGER_ERRORS.ROOM_NOT_FOUND,
        `Room '${sessionId}' does not exist`,
      );
    }

    const closed = this.closeRoomInternal(sessionId);
    return this.ok(closed);
  }

  getRoom(sessionId: SessionId): RoomContract | null {
    const room = this.rooms.get(sessionId);
    return room ? this.cloneRoom(room) : null;
  }

  listRooms(): RoomContract[] {
    return Array.from(this.rooms.values()).map((room) => this.cloneRoom(room));
  }

  private closeRoomInternal(sessionId: SessionId): RoomContract {
    const room = this.rooms.get(sessionId);
    if (!room) {
      return {
        sessionId,
        state: ROOM_STATES.CLOSED,
        seats: { white: null, black: null },
        spectators: [],
        participants: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    room.state = ROOM_STATES.CLOSED;
    room.updatedAt = Date.now();
    const snapshot = this.cloneRoom(room);
    this.rooms.delete(sessionId);
    return snapshot;
  }

  private decideSlot(
    room: RoomContract,
    requestedSeat?: PlayerSeat,
  ): RoomManagerResult<PlayerSlot> {
    const occupiedPlayers = Number(Boolean(room.seats.white)) + Number(Boolean(room.seats.black));

    if (requestedSeat) {
      if (requestedSeat === PLAYER_SLOTS.WHITE && room.seats.white) {
        return this.fail(
          ROOM_MANAGER_ERRORS.SEAT_TAKEN,
          `Seat '${PLAYER_SLOTS.WHITE}' is already occupied`,
        );
      }
      if (requestedSeat === PLAYER_SLOTS.BLACK && room.seats.black) {
        return this.fail(
          ROOM_MANAGER_ERRORS.SEAT_TAKEN,
          `Seat '${PLAYER_SLOTS.BLACK}' is already occupied`,
        );
      }
      if (occupiedPlayers >= this.maxPlayers) {
        return this.fail(
          ROOM_MANAGER_ERRORS.ROOM_FULL,
          `Room '${room.sessionId}' is full for players`,
        );
      }
      return this.ok(requestedSeat);
    }

    if (!room.seats.white && occupiedPlayers < this.maxPlayers) {
      return this.ok(PLAYER_SLOTS.WHITE);
    }

    if (!room.seats.black && occupiedPlayers < this.maxPlayers) {
      return this.ok(PLAYER_SLOTS.BLACK);
    }

    if (room.spectators.length >= this.maxSpectators) {
      if (this.maxSpectators === 0) {
        return this.fail(
          ROOM_MANAGER_ERRORS.ROOM_FULL,
          `Room '${room.sessionId}' is full`,
        );
      }
      return this.fail(
        ROOM_MANAGER_ERRORS.SPECTATOR_CAP_REACHED,
        `Room '${room.sessionId}' spectator cap reached`,
      );
    }

    return this.ok(PLAYER_SLOTS.SPECTATOR);
  }

  private assignSlot(room: RoomContract, playerId: PlayerId, slot: PlayerSlot): void {
    if (slot === PLAYER_SLOTS.WHITE) {
      room.seats.white = playerId;
      return;
    }

    if (slot === PLAYER_SLOTS.BLACK) {
      room.seats.black = playerId;
      return;
    }

    room.spectators.push(playerId);
  }

  private unassignSlot(room: RoomContract, playerId: PlayerId, slot: PlayerSlot): void {
    if (slot === PLAYER_SLOTS.WHITE && room.seats.white === playerId) {
      room.seats.white = null;
      return;
    }

    if (slot === PLAYER_SLOTS.BLACK && room.seats.black === playerId) {
      room.seats.black = null;
      return;
    }

    if (slot === PLAYER_SLOTS.SPECTATOR) {
      room.spectators = room.spectators.filter((id) => id !== playerId);
    }
  }

  private cloneRoom(room: RoomContract): RoomContract {
    return {
      ...room,
      seats: {
        white: room.seats.white,
        black: room.seats.black,
      },
      spectators: [...room.spectators],
      participants: room.participants.map((participant) => ({ ...participant })),
    };
  }

  private ok<T>(data: T): RoomManagerSuccess<T> {
    return { ok: true, data };
  }

  private fail(error: RoomManagerErrorCode, message: string): RoomManagerFailure {
    return { ok: false, error, message };
  }
}
