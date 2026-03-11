import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GameEngine } from "./GameEngine";

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
});
