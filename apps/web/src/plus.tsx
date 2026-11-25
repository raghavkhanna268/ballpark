import { useState } from "react";
import { type PlusPlan, type PlusStatus } from "@ballpark/shared";
import { ApiError, errorCopy, getRestoreCode, postPlusOrder, postPlusVerify, postRestore, postTestUnlock } from "./api";
import { haptic } from "./haptic";

/*
 * Ballpark+: pack journeys, the whole archive, Unlimited, and no ads. The daily game, the league and streaks stay free.
 * Payment is Razorpay Checkout. The server creates the order and checks Razorpay's signature before a pass starts.
 */

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, handler: (failure: { error?: { description?: string } }) => void) => void };
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

function loadCheckout(): Promise<RazorpayConstructor> {
  const existing = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => {
      const loaded = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (loaded) resolve(loaded);
      else reject(new Error("checkout_missing"));
    };
    script.onerror = () => reject(new Error("checkout_blocked"));
    document.head.appendChild(script);
  });
}

function untilText(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The Ballpark+ page: what you get, the two passes, and checkout. */
export function PlusScreen({
  deviceId,
  status,
  onStatus,
  onHome,
  onPacks,
}: {
  deviceId: string;
  status: PlusStatus;
  onStatus: (next: PlusStatus) => void;
  onHome: () => void;
  onPacks: () => void;
}) {
  const [plan, setPlan] = useState<PlusPlan>("year");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = status.prices.find((item) => item.plan === plan) ?? status.prices[0]!;

  async function pay() {
    setBusy(true);
    setError(null);
    haptic("tap");
    try {
      const order = await postPlusOrder(deviceId, plan);
      const Razorpay = await loadCheckout();
      const checkout = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        theme: { color: "#ffb347" },
        handler: (response: RazorpayResponse) => {
          void postPlusVerify(deviceId, {
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
          })
            .then((next) => {
              haptic("good");
              onStatus(next);
            })
            .catch((caught: unknown) => setError(errorCopy(caught)))
            .finally(() => setBusy(false));
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      checkout.on("payment.failed", (failure) => {
        setError(failure.error?.description ?? "The payment didn’t go through. You weren’t charged.");
        setBusy(false);
      });
      checkout.open();
    } catch (caught) {
      setError(caught instanceof ApiError ? errorCopy(caught) : "Razorpay checkout couldn’t load. Check your connection and try again.");
      setBusy(false);
    }
  }

  async function unlock() {
    setBusy(true);
    setError(null);
    try {
      onStatus(await postTestUnlock(deviceId, plan));
      haptic("good");
    } catch (caught) {
      setError(errorCopy(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack plus-page">
      <div className="play-head">
        <button className="text-button" type="button" onClick={onHome}>
          Home
        </button>
      </div>
      <header className="plus-head">
        <p className="kicker">Ballpark+</p>
        <h1>
          More climbs. <span>No ads.</span>
        </h1>
      </header>
      <ul className="perks">
        <li>
          <strong>Pack journeys</strong>
          <span>Cricket Crazy, Screen Time and Space Nerd, each a route of three chapters, with more on the way.</span>
        </li>
        <li>
          <strong>Unlimited rounds</strong>
          <span>Fresh rounds of seven whenever you like, not just once a day.</span>
        </li>
        <li>
          <strong>The whole archive</strong>
          <span>Every past day, not just the last week.</span>
        </li>
        <li>
          <strong>No ads, anywhere</strong>
          <span>Home and results stay clean.</span>
        </li>
        <li>
          <strong>Fair for everyone</strong>
          <span>The daily game, the weekly league and your streaks stay free. A pass never adds league points.</span>
        </li>
      </ul>

      {status.plus ? (
        <section className="card plus-active">
          <h2>You’re on Ballpark+</h2>
          <p>Your pass runs until {untilText(status.expiresAt)}.</p>
          <button className="primary" type="button" onClick={onPacks}>
            Start a journey
          </button>
          <RestoreCodeLine deviceId={deviceId} />
        </section>
      ) : (
        <>
          <div className="plans" role="radiogroup" aria-label="Choose a pass">
            {status.prices.map((item) => (
              <button
                key={item.plan}
                type="button"
                role="radio"
                aria-checked={plan === item.plan}
                className={plan === item.plan ? "plan on" : "plan"}
                onClick={() => setPlan(item.plan)}
              >
                {item.plan === "year" ? <em>Best value</em> : null}
                <span>{item.label}</span>
                <strong>{item.price}</strong>
                <small>{item.note}</small>
              </button>
            ))}
          </div>
          {status.razorpayKeyId ? (
            <button className="primary" type="button" disabled={busy} onClick={() => void pay()}>
              {busy ? "Opening Razorpay…" : `Pay ${chosen.price} with Razorpay`}
            </button>
          ) : (
            <p className="hint">Payments aren’t switched on in this build yet.</p>
          )}
          {status.testUnlock ? (
            <button className="ghost-button" type="button" disabled={busy} onClick={() => void unlock()}>
              Unlock for testing (no payment)
            </button>
          ) : null}
          <p className="fine">
            A one-time pass. It doesn’t renew by itself, and a restore code moves it to a new device. UPI, cards and netbanking through Razorpay.
            {status.testUnlock ? " Prices are placeholders in this build." : ""}
          </p>
          <RestoreForm deviceId={deviceId} onStatus={onStatus} />
        </>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

/** For members: the code that moves this pass to a new phone or browser. */
function RestoreCodeLine({ deviceId }: { deviceId: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "copied" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function show() {
    setState("busy");
    setError(null);
    try {
      setCode((await getRestoreCode(deviceId)).code);
      setState("idle");
    } catch (caught) {
      setError(errorCopy(caught));
      setState("idle");
    }
  }

  return (
    <div className="restore">
      <p className="restore-title">New phone or browser?</p>
      {code ? (
        <>
          <p className="restore-code mono">{code}</p>
          <p className="fine">Enter it on the new device, on this page. The pass moves there, and this device goes back to free. Keep it to yourself.</p>
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              void navigator.clipboard
                .writeText(code)
                .then(() => setState("copied"))
                .catch(() => setState("failed"))
            }
          >
            {state === "copied" ? "Copied" : state === "failed" ? "Copy didn’t work" : "Copy the code"}
          </button>
        </>
      ) : (
        <button className="ghost-button" type="button" disabled={state === "busy"} onClick={() => void show()}>
          {state === "busy" ? "Getting your code…" : "Show my restore code"}
        </button>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

/** For a new device: bring a pass over with the code from the old one. */
function RestoreForm({ deviceId, onStatus }: { deviceId: string; onStatus: (next: PlusStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button className="text-button restore-open" type="button" onClick={() => setOpen(true)}>
        Already have Ballpark+ on another device?
      </button>
    );
  }
  return (
    <form
      className="restore"
      onSubmit={(event) => {
        event.preventDefault();
        const code = String(new FormData(event.currentTarget).get("code") ?? "");
        setBusy(true);
        setError(null);
        void postRestore(deviceId, code)
          .then((next) => {
            haptic("good");
            onStatus(next);
          })
          .catch((caught: unknown) => setError(errorCopy(caught)))
          .finally(() => setBusy(false));
      }}
    >
      <label className="restore-title" htmlFor="restore-code">
        Your restore code
      </label>
      <p className="fine">On the other device, open Ballpark+ and tap “Show my restore code”.</p>
      <div className="restore-row">
        <input id="restore-code" name="code" className="mono" placeholder="BP-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={24} required />
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Moving…" : "Restore"}
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

/** Where an ad would sit for free players. There is no ad network yet, so it is a labelled placeholder. */
export function AdSlot({ onPlus }: { onPlus: () => void }) {
  return (
    <aside className="ad-slot" aria-label="Advertisement">
      <span className="ad-label">Ad</span>
      <p>Your ad here</p>
      <button className="text-button" type="button" onClick={onPlus}>
        Remove ads with Ballpark+
      </button>
    </aside>
  );
}
