import "./MapSetup.css";
import { Flex } from "antd";

function MapSetup({
  increaseMapCount,
  decreaseMapCount,
  updateMapFormat,
  mapFormat,
  mapCount,
}) {
  return (
    <Flex vertical>
      <Flex justify={"space-between"}>
        <div>Format</div>
        <input
          type="text"
          onChange={updateMapFormat}
          defaultValue={mapFormat}
          style={{ width: "50%" }}
        />
      </Flex>
      <Flex justify={"space-between"}>
        <button className="button" onClick={increaseMapCount}>
          +
        </button>
        <span>Current map : {mapCount}</span>
        <button className="button" onClick={decreaseMapCount}>
          -
        </button>
      </Flex>
    </Flex>
  );
}

export default MapSetup;
