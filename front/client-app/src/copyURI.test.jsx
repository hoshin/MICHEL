import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notification } from "antd";

// The module instantiates the team-data socket at import time via the
// Configuration Center's dependency graph; mock it so importing copyURI does
// not open a real WebSocket.
vi.mock("./teamsDataSocket.ts", () => ({
  useTeamsData: () => ({
    teamsData: {},
    status: "open",
    send: vi.fn(),
    consumeCatchupIntent: vi.fn(() => null),
  }),
}));

import { copyURI } from "./ConfigurationCenter.jsx";

function clickEventForHref(href) {
  return {
    preventDefault: vi.fn(),
    target: { getAttribute: () => href },
  };
}

beforeEach(() => {
  vi.spyOn(notification, "open").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("copyURI", () => {
  it("should prevent the default navigation of the anchor", async () => {
    // setup
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const event = clickEventForHref("/game-scene");
    // action
    await copyURI(event);
    // assert
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it("should copy the fully-qualified scene URL to the clipboard", async () => {
    // setup
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const event = clickEventForHref("/game-scene");
    // action
    await copyURI(event);
    // assert
    expect(writeText).toHaveBeenCalledWith("http://localhost:5173/game-scene");
  });

  it("should notify the operator on a successful copy", async () => {
    // setup
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const event = clickEventForHref("/score-scene");
    // action
    await copyURI(event);
    // assert
    expect(notification.open).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Copied to clipboard" }),
    );
  });

  it("should notify the operator with the error message on a failed copy", async () => {
    // setup
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("permission denied")),
      },
    });
    const event = clickEventForHref("/score-scene");
    // action
    await copyURI(event);
    // assert
    expect(notification.open).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Could not copy to clipboard",
        description: expect.stringContaining("permission denied"),
      }),
    );
  });

  it("should notify the operator if no navigator.clipboard.writeText is available", async () => {
    // setup
    vi.stubGlobal("navigator", {
      clipboard: {},
    });
    const event = clickEventForHref("/score-scene");
    // action
    await copyURI(event);
    // assert
    expect(notification.open).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Clipboard not supported",
        description: expect.stringContaining(
          "Your browser does not support copying to the clipboard.",
        ),
      }),
    );
  });

  it("should notify the operator if navigator.clipboard is undefined", async () => {
    // setup
    vi.stubGlobal("navigator", {});
    const event = clickEventForHref("/score-scene");
    // action
    await copyURI(event);
    // assert
    expect(notification.open).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Clipboard not supported",
        description: expect.stringContaining(
          "Your browser does not support copying to the clipboard.",
        ),
      }),
    );
  });

  it("should notify the operator if navigator is undefined", async () => {
    // setup
    const event = clickEventForHref("/score-scene");
    // action
    await copyURI(event);
    // assert
    expect(notification.open).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Clipboard not supported",
        description: expect.stringContaining(
          "Your browser does not support copying to the clipboard.",
        ),
      }),
    );
  });
});
