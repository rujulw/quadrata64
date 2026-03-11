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
});

