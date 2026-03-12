import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BoardSurface } from "./BoardSurface";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("BoardSurface", () => {
  it("dispatches move intent for a legal move path", async () => {
    const onMoveIntent = vi.fn();
    const user = userEvent.setup();

    render(
      <BoardSurface
        snapshot={{
          fen: START_FEN,
          turn: "white",
          moveCount: 0,
          status: "active",
          drawOfferBy: null,
          lastMove: null,
          result: null,
        }}
        orientation="white"
        playerColor="white"
        onMoveIntent={onMoveIntent}
      />,
    );

    await user.click(screen.getByRole("button", { name: "e2" }));
    await user.click(screen.getByRole("button", { name: "e4" }));

    expect(onMoveIntent).toHaveBeenCalledTimes(1);
    expect(onMoveIntent).toHaveBeenCalledWith({ from: "e2", to: "e4", promotion: undefined });
  });

  it("does not dispatch when destination is illegal", async () => {
    const onMoveIntent = vi.fn();
    const user = userEvent.setup();

    render(
      <BoardSurface
        snapshot={{
          fen: START_FEN,
          turn: "white",
          moveCount: 0,
          status: "active",
          drawOfferBy: null,
          lastMove: null,
          result: null,
        }}
        orientation="white"
        playerColor="white"
        onMoveIntent={onMoveIntent}
      />,
    );

    await user.click(screen.getByRole("button", { name: "e2" }));
    await user.click(screen.getByRole("button", { name: "e5" }));

    expect(onMoveIntent).not.toHaveBeenCalled();
  });

  it("dispatches move intent when piece is dragged to a legal square", () => {
    const onMoveIntent = vi.fn();

    render(
      <BoardSurface
        snapshot={{
          fen: START_FEN,
          turn: "white",
          moveCount: 0,
          status: "active",
          drawOfferBy: null,
          lastMove: null,
          result: null,
        }}
        orientation="white"
        playerColor="white"
        onMoveIntent={onMoveIntent}
      />,
    );

    const from = screen.getByRole("button", { name: "e2" });
    const to = screen.getByRole("button", { name: "e4" });

    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
    };

    fireEvent.dragStart(from, { dataTransfer });
    fireEvent.dragOver(to, { dataTransfer });
    fireEvent.drop(to, { dataTransfer });

    expect(onMoveIntent).toHaveBeenCalledTimes(1);
    expect(onMoveIntent).toHaveBeenCalledWith({ from: "e2", to: "e4", promotion: undefined });
  });

  it("does not dispatch move intent when dragged to illegal square", () => {
    const onMoveIntent = vi.fn();

    render(
      <BoardSurface
        snapshot={{
          fen: START_FEN,
          turn: "white",
          moveCount: 0,
          status: "active",
          drawOfferBy: null,
          lastMove: null,
          result: null,
        }}
        orientation="white"
        playerColor="white"
        onMoveIntent={onMoveIntent}
      />,
    );

    const from = screen.getByRole("button", { name: "e2" });
    const to = screen.getByRole("button", { name: "e5" });
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
    };

    fireEvent.dragStart(from, { dataTransfer });
    fireEvent.dragOver(to, { dataTransfer });
    fireEvent.drop(to, { dataTransfer });

    expect(onMoveIntent).not.toHaveBeenCalled();
  });
});
