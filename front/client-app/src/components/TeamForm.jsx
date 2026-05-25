import "./TeamForm.css";
import TeamBanInput from "../TeamBanInput.jsx";
import { Card, Flex } from "antd";

export function TeamForm(props) {
  return (
    <Card size={"small"} style={{ backgroundColor: "#a1a1a1" }}>
      <Flex vertical>
        <Flex
          justify={"space-between"}
          align={"center"}
          style={{ width: "100%", height: "50px", marginBottom: "1em" }}
        >
          <img className="team-logo-img" src={props.teamLogo}></img>
          {props.teamBanLogo ? (
            <img className="team-logo-img" src={props.teamBanLogo}></img>
          ) : undefined}
          <div
            style={{
              fontWeight: 600,
              fontSize: "3.5rem",
              marginRight: "0.2em",
            }}
          >
            {props.teamScore}
          </div>
        </Flex>
        <Flex justify={"space-between"} style={{ marginBottom: "1em" }}>
          <div>Name</div>
          <input
            width={"80%"}
            type="text"
            onChange={props.teamUpdateName}
            defaultValue={props.teamName}
          />
        </Flex>
        <Flex justify={"space-between"} style={{ marginBottom: "1em" }}>
          <div>Score</div>
          <div>
            <button className="button" onClick={props.teamIncreaseScore}>
              +
            </button>
            <button className="button" onClick={props.teamDecreaseScore}>
              -
            </button>
          </div>
        </Flex>
        <Flex justify={"space-between"} style={{ marginBottom: "1em" }}>
          <TeamBanInput
            team={props.side}
            handler={props.teamUpdateBan}
            selected={props.teamBanLogo}
          />
        </Flex>
        <Flex justify={"space-between"} style={{ marginBottom: "1em" }}>
          <div className="section-name">Logo</div>
          <input
            width={"50%"}
            type="text"
            onChange={props.updateTeamLogo}
            defaultValue={props.teamLogo}
          />
        </Flex>
      </Flex>
    </Card>
  );
}
