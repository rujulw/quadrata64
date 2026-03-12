import { fireEvent, render, screen, within } from "@testing-library/react";
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
    const piece = within(from).getByRole("img", { name: "white p" });
    const to = screen.getByRole("button", { name: "e4" });

    fireEvent.mouseDown(piece);
    fireEvent.mouseEnter(to);
    fireEvent.mouseUp(to);

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
    const piece = within(from).getByRole("img", { name: "white p" });
    const to = screen.getByRole("button", { name: "e5" });
    fireEvent.mouseDown(piece);
    fireEvent.mouseEnter(to);
    fireEvent.mouseUp(to);

    expect(onMoveIntent).not.toHaveBeenCalled();
  });

  it("cancels current selection on Escape", async () => {
    const onMoveIntent = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
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
    fireEvent.keyDown(container.querySelector("section")!, { key: "Escape" });
    await user.click(screen.getByRole("button", { name: "e4" }));

    expect(onMoveIntent).not.toHaveBeenCalled();
  });

  it("cancels current selection on right-click", async () => {
    const onMoveIntent = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
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
    fireEvent.contextMenu(container.querySelector("section")!);
    await user.click(screen.getByRole("button", { name: "e4" }));

    expect(onMoveIntent).not.toHaveBeenCalled();
  });

  it("does not make board squares draggable", () => {
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
        onMoveIntent={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "e2" })).toHaveAttribute("draggable", "false");
  });
});
