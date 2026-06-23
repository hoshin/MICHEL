import { Button, Flex, Input } from "antd";

function MapSetup({
  increaseMapCount,
  decreaseMapCount,
  updateMapFormat,
  mapFormat,
  mapCount,
}) {
  return (
    <Flex vertical gap={"small"}>
      <Flex justify={"space-between"} align={"center"} gap={"small"}>
        <span className="field-label">Format</span>
        <Input
          size={"small"}
          onChange={updateMapFormat}
          defaultValue={mapFormat}
          style={{ width: "50%" }}
        />
      </Flex>
      <Flex justify={"space-between"} align={"center"}>
        <Button size={"small"} onClick={increaseMapCount}>
          +
        </Button>
        <span>Current map : {mapCount}</span>
        <Button size={"small"} onClick={decreaseMapCount}>
          -
        </Button>
      </Flex>
    </Flex>
  );
}

export default MapSetup;
