import { useTeamsData } from "../teamsDataSocket.ts";
import {
  CheckCircleOutlined,
  DisconnectOutlined,
  LoginOutlined,
} from "@ant-design/icons";

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
function ConnectionBadge({ corner = "top-left" }) {
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

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 9999,
        padding: "4px 10px",
        borderRadius: 4,
        background: "rgba(0, 0, 0, 0.65)",
        color: colorByStatus[status] ?? "#ffffff",
        fontFamily:
          "ui-monospace, SFMono-Regular, 'Cascadia Code', Consolas, monospace",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.4,
        pointerEvents: "none",
        ...positionStyles[corner],
      }}
    >
      Backend connection: {iconByStatus[status]}
    </div>
  );
}

export default ConnectionBadge;
