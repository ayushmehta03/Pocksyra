import { pushApi } from "./api";
import { urlBase64ToBytes } from "./base64";

export type PushState =
  | "unsupported" // this browser can't do web push
  | "needs-install" // iPhone/iPad only allow it for apps added to the home screen
  | "unavailable" // the server has no push key, or no service worker is running (dev builds)
  | "denied" // the user blocked notifications in the browser
  | "off"
  | "on";

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration();
}

export async function getPushState(opts: { isIOS: boolean; standalone: boolean }): Promise<PushState> {
  if (opts.isIOS && !opts.standalone) return "needs-install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await registration();
  if (!reg) return "unavailable";
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** Asks permission, subscribes this device and tells the server. Throws a readable Error on failure. */
export async function enablePush(): Promise<void> {
  const { enabled, publicKey } = await pushApi.key();
  if (!enabled || !publicKey) throw new Error("Push notifications aren't set up on the server yet.");
  const reg = await registration();
  if (!reg) throw new Error("Push works in the installed or production app, not in a development build.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications are blocked. Allow them in your browser's site settings and try again.");

  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("This browser gave an incomplete push subscription.");
  await pushApi.subscribe({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
}

export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await pushApi.unsubscribe(sub.endpoint).catch(() => {
    /* the server forgets dead endpoints on its own */
  });
  await sub.unsubscribe();
}
