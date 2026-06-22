import { Select } from "antd";
import {
  portraits,
  humanizeKey,
  resolveSelectedValue,
} from "./teamBanInput.helpers.js";

const updateBanForTeam = (value, team, handler) => {
  const command = team === "team1" ? "team1UpdateBan" : "team2UpdateBan";
  handler({ command, value });
};

function TeamBanInput(props) {
  const nameOptions = Object.keys(portraits)
    .map((name) => ({
      value: name,
      label: humanizeKey(name),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const selectedValue = resolveSelectedValue(props.selected);
  return (
    <div>
      <Select
        showSearch={{ optionFilterProp: "value" }}
        placeholder={"Ban for the current map..."}
        value={selectedValue}
        onChange={(value) => updateBanForTeam(value, props.team, props.handler)}
        options={nameOptions}
        style={{ width: "230px" }}
      />
    </div>
  );
}

export default TeamBanInput;
