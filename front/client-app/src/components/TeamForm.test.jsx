import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamForm } from "./TeamForm.jsx";

function renderTeamForm(overrides = {}) {
  const props = {
    teamUpdateName: vi.fn(),
    teamIncreaseScore: vi.fn(),
    teamDecreaseScore: vi.fn(),
    teamName: "",
    teamScore: 0,
    teamLogo: "",
    teamBanLogo: null,
    updateTeamLogo: vi.fn(),
    teamUpdateBan: vi.fn(),
    side: "team1",
    ...overrides,
  };
  return render(<TeamForm {...props} />);
}

describe("TeamForm", () => {
  it("should update team name input if it arrives after the first render", () => {
    // setup — first render mirrors the empty default state, before any
    // FaceIt fetch has populated the name.
    const { rerender } = renderTeamForm({ teamName: "" });
    // action — a later snapshot (e.g. a resolved FaceIt fetch) carries the
    // real team name.
    rerender(
      <TeamForm
        teamUpdateName={vi.fn()}
        teamIncreaseScore={vi.fn()}
        teamDecreaseScore={vi.fn()}
        teamName={"Team Liquid"}
        teamScore={0}
        teamLogo={""}
        teamBanLogo={null}
        updateTeamLogo={vi.fn()}
        teamUpdateBan={vi.fn()}
        side={"team1"}
      />,
    );
    // assert
    expect(screen.getByDisplayValue("Team Liquid")).toBeInTheDocument();
  });

  it("should update the team logo URL if it arrives after the first render", () => {
    // setup
    const { rerender } = renderTeamForm({ teamLogo: "" });
    // action
    rerender(
      <TeamForm
        teamUpdateName={vi.fn()}
        teamIncreaseScore={vi.fn()}
        teamDecreaseScore={vi.fn()}
        teamName={""}
        teamScore={0}
        teamLogo={"https://example.com/logo.png"}
        teamBanLogo={null}
        updateTeamLogo={vi.fn()}
        teamUpdateBan={vi.fn()}
        side={"team1"}
      />,
    );
    // assert
    expect(
      screen.getByDisplayValue("https://example.com/logo.png"),
    ).toBeInTheDocument();
  });
});
