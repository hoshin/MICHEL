import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_STATE } from "./config.js";

// The real module instantiates a WebSocket against the back-end at import
// time, which jsdom cannot honour. Mock the whole module so the component
// renders against a controllable in-memory snapshot.
const teamsDataMock = vi.fn();
vi.mock("./teamsDataSocket.ts", () => ({
  useTeamsData: () => teamsDataMock(),
}));

import ConfigurationCenter from "./ConfigurationCenter.jsx";

function buildHookValue(overrides = {}) {
  return {
    teamsData: {
      ...DEFAULT_STATE,
      ...overrides,
      faceIt: { ...DEFAULT_STATE.faceIt, ...(overrides.faceIt ?? {}) },
    },
    status: "open",
    send: vi.fn(),
    consumeCatchupIntent: vi.fn(() => null),
  };
}

beforeEach(() => {
  window.localStorage.clear();
  teamsDataMock.mockReturnValue(buildHookValue());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ConfigurationCenter FaceIt mode", () => {
  it("should hide the FaceIt section by default when no match id is configured", () => {
    // setup
    teamsDataMock.mockReturnValue(buildHookValue({ faceIt: { matchId: "" } }));
    // action
    render(<ConfigurationCenter />);
    // assert
    expect(screen.queryByText("FaceIt Configuration")).not.toBeInTheDocument();
  });

  it("should reveal the FaceIt section when the operator flips the toggle on", async () => {
    // setup
    const user = userEvent.setup();
    teamsDataMock.mockReturnValue(buildHookValue({ faceIt: { matchId: "" } }));
    render(<ConfigurationCenter />);
    // action
    await user.click(screen.getByRole("switch", { name: "FaceIt mode" }));
    // assert
    expect(screen.getByText("FaceIt Configuration")).toBeInTheDocument();
  });

  it("should auto-enable FaceIt mode when the back-end already carries a match id", () => {
    // setup
    teamsDataMock.mockReturnValue(
      buildHookValue({ faceIt: { matchId: "match-123" } }),
    );
    // action
    render(<ConfigurationCenter />);
    // assert
    expect(screen.getByText("FaceIt Configuration")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "FaceIt mode" })).toBeChecked();
  });

  it("should auto-reveal FaceIt when the match id arrives after the first render", () => {
    // setup — first render mirrors the DEFAULT_STATE snapshot (no match id),
    // exactly like the real socket before its first push.
    teamsDataMock.mockReturnValue(buildHookValue({ faceIt: { matchId: "" } }));
    const { rerender } = render(<ConfigurationCenter />);
    expect(screen.queryByText("FaceIt Configuration")).not.toBeInTheDocument();
    // action — a later snapshot carries the match id.
    teamsDataMock.mockReturnValue(
      buildHookValue({ faceIt: { matchId: "match-123" } }),
    );
    rerender(<ConfigurationCenter />);
    // assert
    expect(screen.getByText("FaceIt Configuration")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "FaceIt mode" })).toBeChecked();
  });

  it("should hide the FaceIt configuration if faceItMode is set to false even if a FaceIt matchId is set", () => {
    // setup
    window.localStorage.setItem("michel.faceItMode", "false");
    teamsDataMock.mockReturnValue(
      buildHookValue({ faceIt: { matchId: "match-123" } }),
    );
    // action
    render(<ConfigurationCenter />);
    // assert
    expect(screen.queryByText("FaceIt Configuration")).not.toBeInTheDocument();
  });
});

describe("ConfigurationCenter FaceIt match id field", () => {
  // The label lives in a header Flex; the Input sits alongside it inside the
  // wrapping vertical Flex, so we climb two levels to reach their shared parent.
  const matchIdInput = () =>
    within(
      screen.getByText("FaceIt match ID").parentElement.parentElement,
    ).getByRole("textbox");

  it("should display the match id currently held by the back-end", () => {
    // setup
    teamsDataMock.mockReturnValue(
      buildHookValue({ faceIt: { matchId: "match-123" } }),
    );
    // action
    render(<ConfigurationCenter />);
    // assert
    expect(matchIdInput()).toHaveValue("match-123");
  });

  it("should reflect a match id that only arrives from the back-end after the first render", () => {
    // setup
    teamsDataMock.mockReturnValue(
      buildHookValue({ faceIt: { matchId: "match-123" } }),
    );
    const { rerender } = render(<ConfigurationCenter />);
    // action — the back-end parses a pasted URL down to a bare id and pushes it back
    teamsDataMock.mockReturnValue(
      buildHookValue({ faceIt: { matchId: "match-456" } }),
    );
    rerender(<ConfigurationCenter />);
    // assert
    expect(matchIdInput()).toHaveValue("match-456");
  });

  it("should send the updateFromMatchId command as the operator types", async () => {
    // setup
    const user = userEvent.setup();
    const hookValue = buildHookValue({ faceIt: { matchId: "" } });
    teamsDataMock.mockReturnValue(hookValue);
    render(<ConfigurationCenter />);
    await user.click(screen.getByRole("switch", { name: "FaceIt mode" }));
    // action
    await user.type(matchIdInput(), "x");
    // assert
    expect(hookValue.send).toHaveBeenCalledWith({
      command: "updateFromMatchId",
      value: "x",
    });
  });

  it("should not render the 'Open in FaceIt' link when no match id is set", async () => {
    // setup
    const user = userEvent.setup();
    teamsDataMock.mockReturnValue(buildHookValue({ faceIt: { matchId: "" } }));
    render(<ConfigurationCenter />);
    await user.click(screen.getByRole("switch", { name: "FaceIt mode" }));
    // assert
    expect(
      screen.queryByRole("link", { name: "Open in FaceIt" }),
    ).not.toBeInTheDocument();
  });

  it("should point the 'Open in FaceIt' link at the room for the current match id", () => {
    // setup
    teamsDataMock.mockReturnValue(
      buildHookValue({ faceIt: { matchId: "match-123" } }),
    );
    // action
    render(<ConfigurationCenter />);
    // assert
    expect(
      screen.getByRole("link", { name: "Open in FaceIt" }),
    ).toHaveAttribute("href", "https://www.faceit.com/en/ow2/room/match-123");
  });
});

describe("ConfigurationCenter dark mode", () => {
  it("should default to light mode (toggle off, no dark body class)", () => {
    // setup / action
    render(<ConfigurationCenter />);
    // assert
    expect(screen.getByRole("switch", { name: "Dark mode" })).not.toBeChecked();
    expect(document.body).not.toHaveClass("michel-dark");
  });

  it("should apply the dark body class when the operator flips the toggle on", async () => {
    // setup
    const user = userEvent.setup();
    render(<ConfigurationCenter />);
    // action
    await user.click(screen.getByRole("switch", { name: "Dark mode" }));
    // assert
    expect(document.body).toHaveClass("michel-dark");
  });

  it("should persist the darkMode choice to localStorage when manually set", async () => {
    // setup
    const user = userEvent.setup();
    render(<ConfigurationCenter />);
    // action
    await user.click(screen.getByRole("switch", { name: "Dark mode" }));
    // assert
    expect(window.localStorage.getItem("michel.darkMode")).toBe("true");
  });

  it("should re-apply, a stored darkMode choice on load", () => {
    // setup
    window.localStorage.setItem("michel.darkMode", "true");
    // action
    render(<ConfigurationCenter />);
    // assert
    expect(screen.getByRole("switch", { name: "Dark mode" })).toBeChecked();
    expect(document.body).toHaveClass("michel-dark");
  });
});

describe("ConfigurationCenter scene links", () => {
  it("should have the scene links table collapsed by default", () => {
    // setup
    render(<ConfigurationCenter />);
    // action
    const trigger = screen.getByText("Scene links");
    // assert
    expect(trigger).toBeInTheDocument();
    expect(
      screen.queryByText("App URLs (click to copy)"),
    ).not.toBeInTheDocument();
  });

  it("should expand the scene links table when its header is clicked", async () => {
    // setup
    const user = userEvent.setup();
    render(<ConfigurationCenter />);
    // action
    await user.click(screen.getByText("Scene links"));
    // assert
    const table = await screen.findByText("App URLs (click to copy)");
    expect(table).toBeInTheDocument();
    expect(
      within(document.body).getByText("Configuration Center"),
    ).toBeInTheDocument();
  });
});
