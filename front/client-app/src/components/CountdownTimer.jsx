import { useTeamsData } from "../teamsDataSocket.ts";
import "./CountdownTimer.css";

/**
 * Read-only display of the countdown that the back-end owns. Subscribes to
 * the shared team-data stream so OBS browser sources receive updates the
 * same way every other overlay does — over the back-end WebSocket rather
 * than via an in-browser BroadcastChannel that does not cross Chromium
 * process boundaries.
 *
 * Default styling lives in CountdownTimer.css (sized to fill an OBS
 * browser source by default). Props are only used to override a specific
 * property for a given context (e.g. shrinking the font for the small
 * preview rendered inside the Configuration Center).
 *
 * @param {object} props
 * @param {string} [props.fontSize] - any valid CSS font-size value
 *   (e.g. "1em", "32px"). Defaults to the responsive value in the CSS.
 * @param {string} [props.color] - any valid CSS color value. Defaults to
 *   the value in the CSS.
 */
function CountdownTimer({ fontSize, color }) {
  const { teamsData } = useTeamsData();
  const remaining = teamsData?.display?.countdown ?? 0;
  // Color resolution order: explicit prop wins over the broadcast color
  // (which itself wins over the CSS default). The empty string means
  // "no user choice yet" and falls through to the CSS class.
  const broadcastColor = teamsData?.display?.countdownColor || "";
  const effectiveColor = color || broadcastColor;

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const formatted = [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");

  // Build the inline override object from the resolved values. Anything
  // left empty falls through to the CSS class.
  const style = {};
  if (fontSize) style.fontSize = fontSize;
  if (effectiveColor) style.color = effectiveColor;

  return (
    <div className="countdown-timer" style={style}>
      {formatted}
    </div>
  );
}

export default CountdownTimer;
