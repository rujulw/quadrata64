import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GAME_ENGINE_ERRORS, GameEngine } from "./GameEngine";
import { TIME_CONTROL_PRESETS } from "./timeControls";

describe("GameEngine", () => {
  it("includes move payload fields and lastMove in snapshot after applyMove", () => {
    const engine = GameEngine.create({
      gameId: "g-1",
      sessionId: "room-1",
      players: { white: "w-1", black: "b-1" },
    });

    const applied = engine.applyMove({
      playerId: "w-1",
      move: { from: "e2", to: "e4" },
    });

    assert.equal(applied.ok, true);
    if (!applied.ok) return;

    assert.equal(applied.data.snapshot.moveCount, 1);
    assert.deepEqual(applied.data.snapshot.lastMove, { from: "e2", to: "e4" });
    assert.equal(applied.data.snapshot.result, null);
    assert.equal(applied.data.gameOver, false);
  });

  it("returns checkmate result payload at game over", () => {
    const engine = GameEngine.create({
      gameId: "g-2",
      sessionId: "room-2",
      players: { white: "w-2", black: "b-2" },
    });

    const moves = [
      { playerId: "w-2", move: { from: "f2", to: "f3" } },
      { playerId: "b-2", move: { from: "e7", to: "e5" } },
      { playerId: "w-2", move: { from: "g2", to: "g4" } },
      { playerId: "b-2", move: { from: "d8", to: "h4" } },
    ] as const;

    let lastResult = null as ReturnType<GameEngine["applyMove"]> | null;
    for (const step of moves) {
      lastResult = engine.applyMove(step);
      assert.equal(lastResult.ok, true);
    }

    assert.ok(lastResult);
    if (!lastResult || !lastResult.ok) return;

    assert.equal(lastResult.data.gameOver, true);
    assert.equal(lastResult.data.snapshot.status, "finished");
    assert.deepEqual(lastResult.data.result, {
      winnerColor: "black",
      reason: "checkmate",
    });
  });

  it("concludes game on resign with opponent as winner", () => {
    const engine = GameEngine.create({
      gameId: "g-3",
      sessionId: "room-3",
      players: { white: "w-3", black: "b-3" },
    });

    const resignResult = engine.resign("w-3");
    assert.equal(resignResult.ok, true);
    if (!resignResult.ok) return;

    assert.equal(resignResult.data.snapshot.status, "finished");
    assert.deepEqual(resignResult.data.result, {
      winnerColor: "black",
      reason: "resign",
    });
  });

  it("concludes game as draw when offer is accepted by opponent", () => {
    const engine = GameEngine.create({
      gameId: "g-4",
      sessionId: "room-4",
      players: { white: "w-4", black: "b-4" },
    });

    const offerResult = engine.offerDraw("w-4");
    assert.equal(offerResult.ok, true);
    if (!offerResult.ok) return;
    assert.equal(offerResult.data.snapshot.drawOfferBy, "white");

    const acceptResult = engine.acceptDraw("b-4");
    assert.equal(acceptResult.ok, true);
    if (!acceptResult.ok) return;

    assert.equal(acceptResult.data.snapshot.status, "finished");
    assert.equal(acceptResult.data.snapshot.drawOfferBy, null);
    assert.deepEqual(acceptResult.data.result, {
      winnerColor: null,
      reason: "draw",
    });
  });

  it("clears pending draw offer when declined by opponent", () => {
    const engine = GameEngine.create({
      gameId: "g-5",
      sessionId: "room-5",
      players: { white: "w-5", black: "b-5" },
    });

    const offerResult = engine.offerDraw("w-5");
    assert.equal(offerResult.ok, true);
    if (!offerResult.ok) return;

    const declineResult = engine.declineDraw("b-5");
    assert.equal(declineResult.ok, true);
    if (!declineResult.ok) return;

    assert.equal(declineResult.data.snapshot.status, "active");
    assert.equal(declineResult.data.snapshot.drawOfferBy, null);
    assert.equal(declineResult.data.snapshot.result, null);
  });

  it("rejects duplicate draw offers while one is pending", () => {
    const engine = GameEngine.create({
      gameId: "g-6",
      sessionId: "room-6",
      players: { white: "w-6", black: "b-6" },
    });

    const firstOffer = engine.offerDraw("w-6");
    assert.equal(firstOffer.ok, true);

    const secondOffer = engine.offerDraw("b-6");
    assert.equal(secondOffer.ok, false);
    if (secondOffer.ok) return;
    assert.equal(secondOffer.error, GAME_ENGINE_ERRORS.DRAW_ALREADY_OFFERED);
  });

  it("rejects accepting a draw when no draw is pending", () => {
    const engine = GameEngine.create({
      gameId: "g-7",
      sessionId: "room-7",
      players: { white: "w-7", black: "b-7" },
    });

    const acceptResult = engine.acceptDraw("b-7");
    assert.equal(acceptResult.ok, false);
    if (acceptResult.ok) return;
    assert.equal(acceptResult.error, GAME_ENGINE_ERRORS.DRAW_NOT_OFFERED);
  });

  it("rejects accepting own draw offer", () => {
    const engine = GameEngine.create({
      gameId: "g-8",
      sessionId: "room-8",
      players: { white: "w-8", black: "b-8" },
    });

    const offerResult = engine.offerDraw("w-8");
    assert.equal(offerResult.ok, true);

    const acceptResult = engine.acceptDraw("w-8");
    assert.equal(acceptResult.ok, false);
    if (acceptResult.ok) return;
    assert.equal(acceptResult.error, GAME_ENGINE_ERRORS.DRAW_CANNOT_ACCEPT_OWN_OFFER);
  });

  it("rejects declining own draw offer", () => {
    const engine = GameEngine.create({
      gameId: "g-9",
      sessionId: "room-9",
      players: { white: "w-9", black: "b-9" },
    });

    const offerResult = engine.offerDraw("w-9");
    assert.equal(offerResult.ok, true);

    const declineResult = engine.declineDraw("w-9");
    assert.equal(declineResult.ok, false);
    if (declineResult.ok) return;
    assert.equal(declineResult.error, GAME_ENGINE_ERRORS.DRAW_CANNOT_DECLINE_OWN_OFFER);
  });

  it("clears pending draw offer after a legal move", () => {
    const engine = GameEngine.create({
      gameId: "g-10",
      sessionId: "room-10",
      players: { white: "w-10", black: "b-10" },
    });

    const offerResult = engine.offerDraw("w-10");
    assert.equal(offerResult.ok, true);
    if (!offerResult.ok) return;
    assert.equal(offerResult.data.snapshot.drawOfferBy, "white");

    const moveResult = engine.applyMove({
      playerId: "w-10",
      move: { from: "e2", to: "e4" },
    });
    assert.equal(moveResult.ok, true);
    if (!moveResult.ok) return;
    assert.equal(moveResult.data.snapshot.drawOfferBy, null);
  });

  it("concludes the game with a timeout result before applying an overdue move", () => {
    const originalNow = Date.now;

    try {
      Date.now = () => 1_000;
      const engine = GameEngine.create({
        gameId: "g-11",
        sessionId: "room-11",
        players: { white: "w-11", black: "b-11" },
        timeControlId: "bullet",
      });

      Date.now = () => 61_500;
      const applied = engine.applyMove({
        playerId: "w-11",
        move: { from: "e2", to: "e4" },
      });

      assert.equal(applied.ok, true);
      if (!applied.ok) return;

      assert.equal(applied.data.gameOver, true);
      assert.equal(applied.data.snapshot.moveCount, 0);
      assert.equal(applied.data.snapshot.status, "finished");
      assert.equal(applied.data.snapshot.timer.whiteMs, 0);
      assert.equal(applied.data.snapshot.timer.runningFor, null);
      assert.deepEqual(applied.data.result, {
        winnerColor: "black",
        reason: "timeout",
      });
    } finally {
      Date.now = originalNow;
    }
  });

  it("applies increment to the mover and hands the running clock to the opponent", () => {
    const originalNow = Date.now;
    const originalBulletIncrement = TIME_CONTROL_PRESETS.bullet.incrementMs;

    try {
      TIME_CONTROL_PRESETS.bullet.incrementMs = 2_000;
      Date.now = () => 2_000;

      const engine = GameEngine.create({
        gameId: "g-12",
        sessionId: "room-12",
        players: { white: "w-12", black: "b-12" },
        timeControlId: "bullet",
      });

      Date.now = () => 5_000;
      const whiteMove = engine.applyMove({
        playerId: "w-12",
        move: { from: "e2", to: "e4" },
      });

      assert.equal(whiteMove.ok, true);
      if (!whiteMove.ok) return;

      assert.equal(whiteMove.data.snapshot.turn, "black");
      assert.equal(whiteMove.data.snapshot.timer.whiteMs, 59_000);
      assert.equal(whiteMove.data.snapshot.timer.blackMs, 60_000);
      assert.equal(whiteMove.data.snapshot.timer.runningFor, "black");
      assert.equal(whiteMove.data.snapshot.timer.updatedAt, 5_000);

      Date.now = () => 8_000;
      const blackMove = engine.applyMove({
        playerId: "b-12",
        move: { from: "e7", to: "e5" },
      });

      assert.equal(blackMove.ok, true);
      if (!blackMove.ok) return;

      assert.equal(blackMove.data.snapshot.turn, "white");
      assert.equal(blackMove.data.snapshot.timer.whiteMs, 59_000);
      assert.equal(blackMove.data.snapshot.timer.blackMs, 59_000);
      assert.equal(blackMove.data.snapshot.timer.runningFor, "white");
      assert.equal(blackMove.data.snapshot.timer.updatedAt, 8_000);
    } finally {
      TIME_CONTROL_PRESETS.bullet.incrementMs = originalBulletIncrement;
      Date.now = originalNow;
    }
  });
});
