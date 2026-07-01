import "./TeamForm.css";
import TeamBanInput from "../TeamBanInput.jsx";
import { Button, Card, Flex, Input } from "antd";

export function TeamForm(props) {
  return (
    <Card size={"small"}>
      <Flex vertical gap={"small"}>
        <Flex
          justify={"space-between"}
          align={"center"}
          className="team-header"
        >
          <img
            className="team-logo-img"
            src={props.teamLogo}
            alt={`${props.side} team logo`}
          ></img>
          {props.teamBanLogo ? (
            <img
              className="team-logo-img"
              src={props.teamBanLogo}
              alt={`${props.side} banned hero portrait`}
            ></img>
          ) : undefined}
          <div className="team-score">{props.teamScore}</div>
        </Flex>
        <Flex justify={"space-between"} align={"center"} gap={"small"}>
          <span className="field-label">Name</span>
          <Input
            size={"small"}
            onChange={props.teamUpdateName}
            value={props.teamName}
          />
        </Flex>
        <Flex justify={"space-between"} align={"center"}>
          <span className="field-label">Score</span>
          <Flex gap={"small"}>
            <Button size={"small"} onClick={props.teamIncreaseScore}>
              +
            </Button>
            <Button size={"small"} onClick={props.teamDecreaseScore}>
              -
            </Button>
          </Flex>
        </Flex>
        <Flex justify={"space-between"}>
          <TeamBanInput
            team={props.side}
            handler={props.teamUpdateBan}
            selected={props.teamBanLogo}
          />
        </Flex>
        <Flex justify={"space-between"} align={"center"} gap={"small"}>
          <span className="field-label">Logo</span>
          <Input
            size={"small"}
            onChange={props.updateTeamLogo}
            value={props.teamLogo}
          />
        </Flex>
      </Flex>
    </Card>
  );
}
