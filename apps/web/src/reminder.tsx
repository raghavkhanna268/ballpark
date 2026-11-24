import { useEffect, useState } from "react";
import { deleteReminder, getReminder, postReminder } from "./api";

/**
 * The streak reminder switch: one browser notification at 8 PM India time on a day you have not played yet,
 * while your streak is alive. It needs the browser's permission and a service worker; where either is missing,
 * or the server has no keys, the switch does not show.
 */
type State = "loading" | "hidden" | "off" | "on" | "working" | "blocked" | "failed";

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function ReminderSwitch({ deviceId }: { deviceId: string }) {
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    if (!supported()) {
      setState("hidden");
      return;
    }
    let live = true;
    getReminder(deviceId).then(
      (status) => {
        if (!live) return;
        setKey(status.key);
        setState(!status.key ? "hidden" : status.on ? "on" : Notification.permission === "denied" ? "blocked" : "off");
      },
      () => live && setState("hidden"),
    );
    return () => {
      live = false;
    };
  }, [deviceId]);

  if (state === "loading" || state === "hidden") return null;

  async function turnOn() {
    if (!key) return;
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(key) }));
      await postReminder(deviceId, subscription.endpoint);
      setState("on");
    } catch {
      setState("failed");
    }
  }

  async function turnOff() {
    setState("working");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
      await deleteReminder(deviceId);
      setState("off");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="reminder">
      <button
        type="button"
        className={`reminder-switch${state === "on" ? " on" : ""}`}
        role="switch"
        aria-checked={state === "on"}
        disabled={state === "working" || state === "blocked"}
        onClick={() => void (state === "on" ? turnOff() : turnOn())}
      >
        <span className="knob" aria-hidden="true" />
        <span>
          <strong>Streak reminder</strong>
          <small>
            {state === "blocked"
              ? "Notifications are blocked for this site in your browser settings."
              : state === "failed"
                ? "That didn’t work. Try again."
                : "One nudge at 8 PM India time if you haven’t played and your streak is alive."}
          </small>
        </span>
      </button>
    </div>
  );
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
