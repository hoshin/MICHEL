import { useState, useEffect } from "react";

export const countdownChannel = new BroadcastChannel("countdown");

export function notifyCountdown(value) {
  countdownChannel.postMessage({ countdown: value });
}

function CountdownTimer() {
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    const channel = new BroadcastChannel("countdown");
    channel.onmessage = (event) => setCountdown(event.data.countdown);
    return () => channel.close();
  }, []);

  const formatted = (() => {
    if (countdown === null) return "--:--:--";
    const h = Math.floor(countdown / 3600);
    const m = Math.floor((countdown % 3600) / 60);
    const s = countdown % 60;
    return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
  })();

  return (
    <div className="countdown-timer">
      {formatted}
    </div>
  );
}

export default CountdownTimer;
