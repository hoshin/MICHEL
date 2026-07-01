import { useTeamsData } from "../teamsDataSocket.ts";
import {
  CheckCircleOutlined,
  DisconnectOutlined,
  LoginOutlined,
} from "@ant-design/icons";
import { Tooltip } from "antd";

/**
 * Tiny diagnostic badge that pins the current WebSocket connection status
 * in a corner of the screen. The badge is always visible — its icon and
 * colour reflect the live status (`connecting` / `open` / `closed`) so
 * the operator can tell at a glance whether the front is talking to the
 * back-end. Previously this had a grace-period gate that hid the badge
 * during normal operation; that was dropped in favour of permanent
 * visibility on the configuration center.
 *
 * Drop this into any overlay during debugging:
 *
 * ```jsx
 * import ConnectionBadge from "./components/ConnectionBadge.jsx";
 * // inside the component's JSX:
 * <ConnectionBadge />
 * ```
 */
function ConnectionBadge({ corner = "top-left", inline = false }) {
  const { status } = useTeamsData();

  const positionStyles = {
    "bottom-right": { right: 16, bottom: 12 },
    "bottom-left": { left: 16, bottom: 12 },
    "top-right": { right: 16, top: 12 },
    "top-left": { left: 16, top: 12 },
  };
  const iconByStatus = {
    connecting: <LoginOutlined />,
    closed: <DisconnectOutlined />,
    open: <CheckCircleOutlined />,
  };

  const colorByStatus = {
    connecting: "#dba300",
    closed: "#c0382e",
    open: "#46a35e",
  };

  // Inline mode lets the badge live inside a layout (e.g. the Config Center
  // header) so it never overlaps page content. The fixed/overlay placement
  // stays the default for OBS browser sources dropped onto a scene.
  //
  // The overlay variant disables pointer events so it never intercepts clicks
  // meant for the page underneath; the inline variant must keep them enabled,
  // otherwise the Tooltip never receives the hover that triggers it.
  const placementStyle = inline
    ? { position: "static" }
    : {
        position: "fixed",
        zIndex: 9999,
        pointerEvents: "none",
        ...positionStyles[corner],
      };

  return (
    <Tooltip
      placement="rightTop"
      title={`Backend connection status: ${status}`}
    >
      <div
        style={{
          ...placementStyle,
          padding: "4px 10px",
          borderRadius: 4,
          color: colorByStatus[status] ?? "#ffffff",
          fontFamily:
            "ui-monospace, SFMono-Regular, 'Cascadia Code', Consolas, monospace",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          whiteSpace: "nowrap",
        }}
      >
        {iconByStatus[status]}
      </div>
    </Tooltip>
  );
}

export default ConnectionBadge;
