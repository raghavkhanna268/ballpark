import { useEffect, useState } from "react";
import {
  NAME_CAP,
  PACK_QUESTIONS,
  canCompare,
  classicStep,
  type Guess,
  type PackResponse,
  type PackResult,
  type PackSummary,
  type PlusPlan,
  type PlusStatus,
  type PuzzleResponse,
  type Reveal,
} from "@ballpark/shared";
import { ApiError, errorCopy, getPack, postPackGuess, postPlusOrder, postPlusVerify, postTestUnlock } from "./api";
import { CountUp, Tally, currentCombo } from "./game";
import { haptic, shareText } from "./haptic";
import { EarlyBlock } from "./rivals";
import { QuestionScreen, RevealScreen } from "./screens";

/*
 * Ballpark+: themed packs and no ads. The daily game, the league and streaks stay free.
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
          <strong>Themed packs, any day</strong>
          <span>Cricket Crazy, Screen Time and Space Nerd, with new packs on the way. Play them whenever you like.</span>
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
            Play a pack
          </button>
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
            A one-time pass for this device. It doesn’t renew by itself. UPI, cards and netbanking through Razorpay.
            {status.testUnlock ? " Prices are placeholders in this build." : ""}
          </p>
        </>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

/** Home card: the packs, locked or ready, and the way in to Ballpark+. */
export function PacksCard({
  packs,
  status,
  onPack,
  onPlus,
}: {
  packs: PackSummary[];
  status: PlusStatus | null;
  onPack: (id: string) => void;
  onPlus: () => void;
}) {
  if (packs.length === 0) return null;
  const plus = status?.plus ?? false;
  const cheapest = status?.prices.find((item) => item.plan === "month");
  return (
    <section className="card packs-card" aria-label="Themed packs">
      <div className="mode-top">
        <h2>Themed packs</h2>
        <p className="plus-tag">{plus ? "Ballpark+" : "Ballpark+ only"}</p>
      </div>
      <ul className="pack-list">
        {packs.map((pack) => (
          <li key={pack.id}>
            <button type="button" className={pack.locked ? "pack-row locked" : "pack-row"} onClick={() => (pack.locked ? onPlus() : onPack(pack.id))}>
              <span className="pack-emoji" aria-hidden="true">
                {pack.emoji}
              </span>
              <span className="pack-text">
                <strong>{pack.title}</strong>
                <small>{pack.blurb}</small>
              </span>
              <span className="pack-state">{pack.locked ? "🔒" : pack.score !== null ? `${pack.score} pts` : pack.answered > 0 ? `${pack.answered}/${pack.questions}` : "Play"}</span>
            </button>
          </li>
        ))}
      </ul>
      {plus ? null : (
        <button className="primary" type="button" onClick={onPlus}>
          Get Ballpark+{cheapest ? ` · ${cheapest.price} a month` : ""}
        </button>
      )}
    </section>
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

type PackPhase = { name: "loading" } | { name: "ask"; index: number } | { name: "reveal"; index: number; reveal: Reveal } | { name: "end" };

/** One themed pack, played with the same question and reveal screens as Classic. */
export function PackRun({
  deviceId,
  packId,
  onHome,
  onFlight,
  onHop,
  onEnd,
}: {
  deviceId: string;
  packId: string;
  onHome: () => void;
  /** How high the climber already is when the pack opens, the points so far, and the right answers in a row. */
  onFlight: (progress: number, score: number, combo: number) => void;
  /** One answer scored: its points, its tier label when it scored any, and what the player typed. */
  onHop: (points: number, label: string | null, answer: string) => void;
  onEnd: () => void;
}) {
  const [pack, setPack] = useState<PackResponse | null>(null);
  const [phase, setPhase] = useState<PackPhase>({ name: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void getPack(deviceId, packId)
      .then((loaded) => {
        if (!live) return;
        setPack(loaded);
        const points = loaded.questions.map((question) => question.reveal?.points ?? null);
        onFlight(flight(loaded), points.reduce<number>((sum, value) => sum + (value ?? 0), 0), currentCombo(points));
        if (loaded.result) {
          setPhase({ name: "end" });
          onEnd();
          return;
        }
        const index = loaded.questions.findIndex((question) => question.reveal === null);
        setPhase({ name: "ask", index: Math.max(0, index) });
      })
      .catch((caught: unknown) => live && setError(errorCopy(caught)));
    return () => {
      live = false;
    };
    // The pack loads once per open, so the parent's callbacks are left out of the dependencies on purpose.
  }, [deviceId, packId]);

  if (error && !pack) {
    return (
      <div className="stack">
        <p className="form-error">{error}</p>
        <button className="text-button" type="button" onClick={onHome}>
          Back home
        </button>
      </div>
    );
  }
  if (!pack || phase.name === "loading") return <p className="status">Loading the pack…</p>;

  const puzzle = asPuzzle(pack);

  async function submit(index: number, guess: Guess) {
    const question = pack!.questions[index];
    if (!question) return;
    setBusy(true);
    setError(null);
    haptic("tap");
    try {
      const response = await postPackGuess(deviceId, packId, question.id, guess);
      const questions = pack!.questions.map((item, itemIndex) => (itemIndex === index ? { ...item, reveal: response.reveal } : item));
      setPack({ ...pack!, questions, result: response.result });
      onHop(response.reveal.points, response.reveal.points > 0 ? response.reveal.label : null, guess.type === "name_one" ? guess.text : "");
      haptic(response.reveal.band === "green" ? "good" : response.reveal.band === "black" ? "bad" : "ok");
      setPhase({ name: "reveal", index, reveal: response.reveal });
    } catch (caught) {
      setError(errorCopy(caught));
    } finally {
      setBusy(false);
    }
  }

  if (phase.name === "ask") {
    return (
      <QuestionScreen
        puzzle={puzzle}
        question={pack.questions[phase.index]!}
        index={phase.index}
        busy={busy}
        error={error}
        onHome={onHome}
        onSubmit={(guess) => void submit(phase.index, guess)}
      />
    );
  }
  if (phase.name === "reveal") {
    const last = phase.index === pack.questions.length - 1;
    return (
      <RevealScreen
        puzzle={puzzle}
        question={pack.questions[phase.index]!}
        reveal={phase.reveal}
        index={phase.index}
        last={last}
        lastLabel="See the pack"
        onHome={onHome}
        onNext={() => {
          if (last) {
            setPhase({ name: "end" });
            onEnd();
            return;
          }
          setPhase({ name: "ask", index: phase.index + 1 });
        }}
      />
    );
  }
  return pack.result ? <PackEnd pack={pack} result={pack.result} onHome={onHome} /> : null;
}

function PackEnd({ pack, result, onHome }: { pack: PackResponse; result: PackResult; onHome: () => void }) {
  const [shared, setShared] = useState<"idle" | "shared" | "copied" | "failed">("idle");
  const { rank, players, next } = result.place;
  return (
    <div className="stack end">
      <p className="kicker">
        Ballpark+ · {pack.pack.emoji} {pack.pack.title}
      </p>
      <p className="mission">Pack complete</p>
      <h2>You reached {result.reached}</h2>
      <p className="score">
        <CountUp value={result.score} pad={3} />
        <span> pts</span>
      </p>
      <Tally rows={pack.questions.map((question) => question.reveal)} />
      {canCompare(players) ? (
        <div className="rank-block">
          <h2>
            You’re #{rank} <span>of {players} who played this pack</span>
          </h2>
          <p className="players">{next ? `${next.gap} pts behind #${next.rank}.` : "Nobody has climbed higher on this pack."}</p>
        </div>
      ) : (
        <EarlyBlock players={players} what="this pack" />
      )}
      <p className="emoji-row" aria-label="Question bands">
        {result.emojis.join("")}
      </p>
      <pre className="share-card">{result.shareText}</pre>
      <button
        className="primary"
        type="button"
        onClick={() => {
          haptic("tap");
          void shareText(result.shareText).then((outcome) => setShared(outcome === "cancelled" ? "idle" : outcome));
        }}
      >
        {shared === "copied" ? "Copied" : shared === "shared" ? "Shared" : shared === "failed" ? "Copy didn’t work" : "Share"}
      </button>
      <button className="text-button" type="button" onClick={onHome}>
        Back home
      </button>
    </div>
  );
}

/** A pack in the shape the Classic screens read. */
function asPuzzle(pack: PackResponse): PuzzleResponse {
  return {
    date: "",
    puzzleNumber: 0,
    theme: `${pack.pack.emoji} ${pack.pack.title}`,
    blurb: pack.pack.blurb,
    nextTheme: "",
    mode: "classic",
    shareHost: "",
    devDate: false,
    questions: pack.questions,
    result: null,
    field: { players: 0, averageProgress: null, bestProgress: null },
  };
}

function flight(pack: PackResponse): number {
  return pack.questions.reduce((sum, question) => (question.reveal ? sum + classicStep(question.reveal.points, NAME_CAP, PACK_QUESTIONS) : sum), 0);
}
