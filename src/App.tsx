import { TownProgress, StoryDock, DecisionOrigin } from "./components/Stories";
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  AudioLines,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Coins,
  Compass,
  Eye,
  Focus,
  Heart,
  House,
  Leaf,
  LockKeyhole,
  MessageCircle,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Settings2,
  SkipForward,
  Sparkles,
  Sprout,
  Sun,
  Users,
  Vote,
  X,
} from "lucide-react";
import { startSync, useTown } from "./store";
import { dayOf } from "./world/engine";
import { buildings } from "./world/map";
import type { Provider } from "./world/types";
const Town = lazy(() => import("./components/Town"));
const pretty = (v: number) => Math.round(v).toLocaleString();
class SceneBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="scene-fallback">
        <Sprout size={40} />
        <h2>The 3D view needs WebGL</h2>
        <p>
          Enable hardware acceleration in your browser. Your town and its
          controls are still available.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <div>
        <span className="eyebrow">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
function ProviderBadge({ provider }: { provider: Provider }) {
  return (
    <span className={`provider-badge ${provider}`}>
      <span className={`dot ${provider}`} />
      {provider === "terra" ? "Sol" : "Sonnet"}
    </span>
  );
}
function CitizenPanel() {
  const world = useTown((s) => s.world),
    selected = useTown((s) => s.selected),
    select = useTown((s) => s.select),
    follow = useTown((s) => s.follow),
    following = useTown((s) => s.following);
  const c = world.citizens.find((c) => c.id === selected),
    b = buildings.find((b) => b.id === selected);
  if (!c && !b) return null;
  return (
    <aside className="inspect panel">
      <button
        className="icon-btn close"
        aria-label="Close inspection"
        onClick={() => select(null)}
      >
        <X size={16} />
      </button>
      {c ? (
        <>
          <span className="eyebrow">A life in little civilization</span>
          <div className="person-title">
            <div className="portrait" style={{ background: c.color }}>
              <span style={{ background: c.skin }} />
              <i />
            </div>
            <div>
              <h2>{c.name}</h2>
              <p>
                {c.job} <span>·</span> <ProviderBadge provider={c.provider} />
              </p>
            </div>
          </div>
          <p className="personality">{c.personality}</p>
          <div className="doing">
            <span className="status-pulse" />
            <span>{c.action.charAt(0).toUpperCase() + c.action.slice(1)}</span>
            <small>“{c.message}”</small>
          </div>
          <div className="meters">
            {[
              ["Happiness", c.happiness, "#8c9e6b"],
              ["Energy", c.energy, "#c7a363"],
              ["Fullness", 100 - c.hunger, "#b88867"],
            ].map(([label, value, color]) => (
              <div key={label}>
                <span>
                  {label}
                  <b>{Math.round(Number(value))}%</b>
                </span>
                <div className="meter">
                  <i
                    style={{ width: `${value}%`, background: String(color) }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="personal-gold">
            <Coins size={14} /> {pretty(c.wealth)} personal gold
          </div>
          <button
            className={`soft-button full ${following === c.id ? "active" : ""}`}
            onClick={() => follow(following === c.id ? null : c.id)}
          >
            <Focus size={15} />
            {following === c.id ? "Stop following" : "Follow citizen"}
          </button>
          <DecisionOrigin id={c.id} />
          <h4>Connections</h4>
          {Object.entries(c.relationships).length ? (
            Object.entries(c.relationships)
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
              .slice(0, 3)
              .map(([id, score]) => (
                <button
                  className="relationship"
                  key={id}
                  onClick={() => select(id)}
                >
                  <span>{world.citizens.find((p) => p.id === id)?.name}</span>
                  <small>
                    {score > 35
                      ? "Ally"
                      : score > 0
                        ? "Friend"
                        : score < -35
                          ? "Enemy"
                          : "Rival"}{" "}
                    · {score > 0 ? "+" : ""}
                    {score}
                  </small>
                </button>
              ))
          ) : (
            <p className="muted">Every friendship starts somewhere.</p>
          )}
          <h4>Little memories</h4>
          <div className="memories">
            {c.memories.slice(0, 3).map((m, i) => (
              <p key={i}>
                <span />
                {m}
              </p>
            ))}
          </div>
        </>
      ) : (
        b && (
          <>
            <span className="eyebrow">Around the neighborhood</span>
            <div className="building-illustration">
              <House size={54} strokeWidth={1} />
            </div>
            <h2>{b.name}</h2>
            <p className="muted">
              {b.kind === "home"
                ? `A cozy place for ${world.citizens.find((c) => c.home === b.id)?.name} to rest and recharge.`
                : b.kind === "hall"
                  ? "Where a little democracy grows. Elections take place every ten town days."
                  : b.kind === "farm"
                    ? "A little sunshine, a little patience, and food for the whole town."
                    : b.kind === "market"
                      ? "The heart of local trade. Citizens exchange gold for food and good company."
                      : b.kind === "forest"
                        ? "Timber for the next chapter. Woodcutters gather resources here."
                        : b.kind === "construction"
                          ? `A new library for curious minds. Construction is ${world.construction}% complete.`
                          : "A gathering place for friendships, alliances, and everyday stories."}
            </p>
            {b.owner && (
              <button
                className="soft-button full"
                onClick={() => select(b.owner!)}
              >
                <Users size={15} />
                Meet the resident
              </button>
            )}
            {b.kind === "hall" && (
              <>
                <h4>Current mayor</h4>
                <button
                  className="relationship"
                  onClick={() => select(world.mayor)}
                >
                  {world.citizens.find((c) => c.id === world.mayor)?.name}
                  <ChevronRight size={14} />
                </button>
                <p className="muted">
                  Tax {Math.round(world.tax * 100)}% · Priority:{" "}
                  {world.priority}
                </p>
                <h4>Last election</h4>
                <p className="muted">
                  {world.elections[0]
                    ? `Day ${world.elections[0].day} · ${Object.values(world.elections[0].votes).reduce((a, b) => a + b, 0)} votes cast`
                    : "The town’s first election is still ahead."}
                </p>
              </>
            )}
          </>
        )
      )}
    </aside>
  );
}
function Settings({ close }: { close: () => void }) {
  const snapshot = useTown((s) => s.snapshot),
    world = useTown((s) => s.world),
    storage = useTown((s) => s.storage),
    admin = useTown((s) => s.admin),
    setAdmin = useTown((s) => s.setAdmin),
    command = useTown((s) => s.command),
    busy = useTown((s) => s.busy);
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-label="Town settings"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="icon-btn close"
          onClick={close}
          aria-label="Close settings"
        >
          <X size={18} />
        </button>
        <span className="eyebrow">The workings of this little world</span>
        <h2>Town settings</h2>
        <div className="setting-section">
          <h4>
            <Radio size={15} /> Simulation mode
          </h4>
          <div className="segmented">
            <button
              className={world.mode === "demo" ? "active" : ""}
              disabled={busy}
              onClick={() => void command("mode", "demo")}
            >
              <Leaf size={14} />
              Free demo
            </button>
            <button
              className={world.mode === "ai" ? "active" : ""}
              disabled={busy}
              onClick={() => void command("mode", "ai")}
            >
              <Sparkles size={14} />
              Real AI
            </button>
          </div>
          <p className="muted">
            Demo citizens make deterministic decisions, form relationships, and
            hold elections for free. Real AI needs server-side model
            configuration.
          </p>
        </div>
        <div className="setting-section">
          <h4>
            <LockKeyhole size={15} /> Shared town operator
          </h4>
          <label htmlFor="operator">Operator secret</label>
          <input
            id="operator"
            type="password"
            autoComplete="off"
            value={admin}
            onChange={(e) => setAdmin(e.target.value)}
            placeholder="Only needed for shared town controls"
          />
          <p className="muted">
            Kept in this tab’s memory only. Visitors can watch freely; changes
            to a shared town require its operator secret. Provider keys belong
            exclusively in Vercel.
          </p>
        </div>
        <div className="setting-section">
          <h4>
            <AudioLines size={15} /> Today’s AI usage · UTC
          </h4>
          {(["terra", "sonnet"] as const).map((provider) => {
            const usage = snapshot?.usage.find((u) => u.provider === provider),
              status = snapshot?.providers.find((p) => p.provider === provider);
            return (
              <div className="usage-row" key={provider}>
                <div>
                  <ProviderBadge provider={provider} />
                  <strong>
                    ${((usage?.chargedMicros ?? 0) / 1e6).toFixed(4)}
                  </strong>
                  <small>
                    {pretty(usage?.chargedTokens ?? 0)} charged tokens ·{" "}
                    {usage?.calls ?? 0} calls
                  </small>
                </div>
                <p>
                  {status?.model ?? "Model not configured"}
                  <br />
                  {status?.issue ??
                    (storage === "postgres"
                      ? "Configured · not an access check"
                      : "Available after database setup")}
                </p>
                <p className="actual-usage">
                  {pretty(usage?.actualTokens ?? 0)} actual tokens · $
                  {((usage?.actualMicros ?? 0) / 1e6).toFixed(4)} settled ·{" "}
                  {usage?.errors ?? 0} failed calls
                </p>
                {world.lastTick?.providers[provider] && (
                  <p
                    className={
                      world.lastTick.providers[provider]!.status === "fallback"
                        ? "provider-failure"
                        : ""
                    }
                  >
                    Last tick:{" "}
                    {world.lastTick.providers[provider]!.status === "ai"
                      ? "AI decisions used"
                      : world.lastTick.providers[provider]!.status ===
                          "fallback"
                        ? "Fallback used"
                        : "Demo"}{" "}
                    · {world.lastTick.providers[provider]!.detail}
                  </p>
                )}
              </div>
            );
          })}
          <p className="muted">
            Daily ceiling: ${snapshot?.budgets.dailyUsd ?? 5} /{" "}
            {pretty(snapshot?.budgets.dailyTokens ?? 200000)} tokens total. Per
            provider: ${snapshot?.budgets.providerDailyUsd ?? 2} /{" "}
            {pretty(snapshot?.budgets.providerDailyTokens ?? 100000)} tokens.
            Uncertain calls retain their full reservation.
          </p>
        </div>
        <div className="setting-section">
          <h4>Town snapshots</h4>
          <div className="snapshot-buttons">
            <button
              className="soft-button"
              disabled={busy}
              onClick={() => void command("save")}
            >
              <ArrowDownToLine size={15} />
              Save snapshot
            </button>
            <button
              className="soft-button"
              disabled={busy}
              onClick={() => void command("load")}
            >
              <ArrowUpFromLine size={15} />
              Load & pause
            </button>
          </div>
          <p className="muted">
            {storage === "postgres"
              ? "The live world saves automatically after every tick. Snapshots also persist in Postgres."
              : "Private demo saves stay in this browser. They are separate from the shared town."}{" "}
            Loading never resets AI usage.
          </p>
        </div>
        <button className="primary-button full" onClick={close}>
          Back to the little things <ChevronRight size={15} />
        </button>
      </section>
    </div>
  );
}
export default function App() {
  const world = useTown((s) => s.world),
    storage = useTown((s) => s.storage),
    error = useTown((s) => s.error),
    command = useTown((s) => s.command),
    step = useTown((s) => s.step),
    busy = useTown((s) => s.busy),
    select = useTown((s) => s.select),
    selected = useTown((s) => s.selected),
    reset = useTown((s) => s.resetCamera),
    cinematic = useTown((s) => s.cinematic),
    setCinematic = useTown((s) => s.setCinematic);
  const [settings, setSettings] = useState(false),
    [feed, setFeed] = useState(true),
    [tab, setTab] = useState<"all" | "terra" | "sonnet">("all"),
    [help, setHelp] = useState(false),
    [roster, setRoster] = useState(false);
  useEffect(() => startSync(), []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettings(false);
        select(null);
        setHelp(false);
        setRoster(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [select]);
  const happiness = world.citizens.reduce((n, c) => n + c.happiness, 0) / 20,
    mayor = world.citizens.find((c) => c.id === world.mayor)!;
  const day = dayOf(world);
  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Little Civilization home">
          <div className="brand-mark">
            <Sprout size={25} strokeWidth={1.5} />
          </div>
          <div>
            little civilization<span>A WORLD OF THEIR OWN</span>
          </div>
        </a>
        <nav>
          <button
            className="nav-active"
            onClick={() => {
              select(null);
              setRoster(false);
            }}
          >
            The town
          </button>
          <button onClick={() => setRoster(!roster)}>
            Citizens <span>20</span>
          </button>
          <button onClick={() => select("hall")}>Town hall</button>
        </nav>
        <div className="top-right">
          <button
            className="icon-btn mobile-citizens"
            aria-label="Open citizen list"
            onClick={() => setRoster(!roster)}
          >
            <Users size={17} />
          </button>
          <span className="live-label">
            <span className="status-pulse" />
            {storage === "postgres"
              ? "Shared world"
              : storage === "connecting"
                ? "Connecting"
                : "Private demo"}
          </span>
          <button
            className="icon-btn"
            aria-label="Open town settings"
            onClick={() => setSettings(true)}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>
      <div className="game">
        <div className="scene" data-testid="town-scene">
          <SceneBoundary>
            <Suspense
              fallback={
                <div className="scene-fallback">
                  <Sprout className="loading-sprout" size={35} />
                  <p>Growing a little world…</p>
                </div>
              }
            >
              <Town />
            </Suspense>
          </SceneBoundary>
        </div>
        <TownProgress />
        <StoryDock />
        <div className="date-pill panel">
          <Sun size={22} />
          <div>
            <strong>Day {day}</strong>
            <small>
              {
                [
                  "Morning light",
                  "A slow afternoon",
                  "Golden hour",
                  "Evening glow",
                  "Under the stars",
                  "Before the dawn",
                ][world.tick % 6]
              }
            </small>
          </div>
          <span>YEAR 01</span>
        </div>
        <div className="resource-bar panel">
          <Stat icon={<Users size={19} />} label="Citizens" value="20" />
          <Stat
            icon={<Sprout size={21} />}
            label="Food"
            value={pretty(world.food)}
          />
          <Stat
            icon={<Coins size={20} />}
            label="Treasury"
            value={pretty(world.gold)}
          />
          <Stat
            icon={<Heart size={19} />}
            label="Happiness"
            value={`${Math.round(happiness)}%`}
          />
          <button className="mayor-stat" onClick={() => select(mayor.id)}>
            <span className="mayor-icon">
              <Vote size={19} />
            </span>
            <div>
              <span className="eyebrow">Our mayor</span>
              <strong>
                {mayor.name}
                <ChevronDown size={12} />
              </strong>
            </div>
            <small>
              Election in {10 - (Math.floor(world.tick / 6) % 10)} days
            </small>
          </button>
        </div>
        <div className="map-tools panel">
          <button
            className="icon-btn"
            aria-label="Reset camera"
            title="Reset camera"
            onClick={reset}
          >
            <RotateCcw size={17} />
          </button>
          <span />
          <button
            className={`icon-btn ${cinematic ? "active" : ""}`}
            aria-label="Toggle cinematic camera"
            title="Cinematic orbit"
            onClick={() => setCinematic(!cinematic)}
          >
            <Eye size={18} />
          </button>
          <button
            className="icon-btn"
            aria-label="Show camera help"
            title="Camera controls"
            onClick={() => setHelp(!help)}
          >
            <CircleHelp size={18} />
          </button>
        </div>
        {help && (
          <div className="camera-help panel">
            <strong>Make yourself at home</strong>
            <p>
              Drag to orbit · Scroll to zoom
              <br />
              Right-drag to pan · Click to explore
            </p>
            <p>
              Select a citizen to follow their story.
              <br />
              Esc closes panels.
            </p>
          </div>
        )}
        {!selected && !roster && (
          <div className="town-notice">
            <span className="notice-icon">
              <Leaf size={20} />
            </span>
            <div>
              <strong>Life moves at its own pace.</strong>
              <p>Click a citizen to discover their story.</p>
            </div>
          </div>
        )}
        <CitizenPanel />
        {roster && (
          <section className="roster panel">
            <button
              className="icon-btn close"
              aria-label="Close citizen list"
              onClick={() => setRoster(false)}
            >
              <X size={16} />
            </button>
            <span className="eyebrow">Twenty stories, still unfolding</span>
            <h2>Meet the neighbors</h2>
            <div className="roster-list">
              {world.citizens.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    select(c.id);
                    setRoster(false);
                  }}
                >
                  <span
                    className="roster-avatar"
                    style={{ background: c.color }}
                  >
                    {c.name[0]}
                  </span>
                  <span>
                    <strong>{c.name}</strong>
                    <small>
                      {c.job} · {c.action}
                    </small>
                  </span>
                  <span className={`dot ${c.provider}`} />
                  <ChevronRight size={14} />
                </button>
              ))}
            </div>
          </section>
        )}
        <aside className={`event-feed panel ${feed ? "" : "collapsed"}`}>
          <button className="feed-heading" onClick={() => setFeed(!feed)}>
            <span>
              <span className="feed-dot" />
              Around the town <small>LIVE</small>
            </span>
            <ChevronDown size={15} className={feed ? "" : "rotated"} />
          </button>
          {feed && (
            <>
              <div className="feed-tabs">
                {(["all", "terra", "sonnet"] as const).map((t) => (
                  <button
                    className={tab === t ? "active" : ""}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    {t === "all"
                      ? "All stories"
                      : t === "terra"
                        ? "Sol"
                        : "Sonnet"}
                  </button>
                ))}
              </div>
              <div className="event-items" aria-live="polite">
                {world.events
                  .filter(
                    (e) =>
                      tab === "all" ||
                      world.citizens.some(
                        (c) => c.provider === tab && e.text.includes(c.name),
                      ) ||
                      e.type === "system",
                  )
                  .slice(0, 4)
                  .map((e) => (
                    <button
                      className="event-item"
                      key={e.id}
                      disabled={!e.citizenId}
                      title={e.citizenId ? "Watch this story" : undefined}
                      onClick={() => {
                        if (e.citizenId) {
                          select(e.citizenId);
                          useTown.getState().follow(e.citizenId);
                        }
                      }}
                    >
                      <div className={`event-symbol ${e.type}`}>
                        {e.type === "election" ? (
                          <Vote size={14} />
                        ) : e.type === "world" ? (
                          <Sprout size={14} />
                        ) : e.type === "system" ? (
                          <Settings2 size={14} />
                        ) : (
                          <MessageCircle size={14} />
                        )}
                      </div>
                      <div>
                        <p>{e.text}</p>
                        <small>
                          {e.tick === world.tick
                            ? "Just now"
                            : `${world.tick - e.tick} tick${world.tick - e.tick === 1 ? "" : "s"} ago`}
                        </small>
                      </div>
                    </button>
                  ))}
              </div>
              <div className="feed-footer">
                Little moments. A bigger story.
                <Sparkles size={12} />
              </div>
            </>
          )}
        </aside>
        <div className="factions panel">
          <div className="faction-title">
            <span>The minds behind the town</span>
            <Sparkles size={13} />
          </div>
          {(["terra", "sonnet"] as const).map((p) => {
            const citizens = world.citizens.filter((c) => c.provider === p);
            return (
              <div className="faction-row" key={p}>
                <ProviderBadge provider={p} />
                <span>10 citizens</span>
                <small>
                  <Heart size={11} />
                  {Math.round(
                    citizens.reduce((n, c) => n + c.happiness, 0) / 10,
                  )}
                  %
                </small>
              </div>
            );
          })}
          <div className="faction-line">
            <span />
            <span />
          </div>
          <p>Different minds. Shared possibilities.</p>
        </div>
        <div className="control-bar panel">
          <button
            className="play-button"
            disabled={busy}
            aria-label={world.paused ? "Play simulation" : "Pause simulation"}
            onClick={() => void command(world.paused ? "play" : "pause")}
          >
            {world.paused ? (
              <Play size={18} fill="currentColor" />
            ) : (
              <Pause size={18} fill="currentColor" />
            )}
          </button>
          <div className="play-state">
            <strong>
              {busy
                ? "A moment…"
                : world.paused
                  ? "Taking a breath"
                  : "Life is unfolding"}
            </strong>
            <span>
              {storage === "postgres"
                ? "Scheduled on the server"
                : "One decision every minute"}
            </span>
          </div>
          <button
            className="icon-btn step"
            disabled={busy}
            aria-label="Advance one tick"
            title="Advance one tick (shared towns require operator access)"
            onClick={() => void step()}
          >
            <SkipForward size={17} />
          </button>
          <div className="control-divider" />
          <div
            className="speed-controls"
            title="Animation speed; AI decisions remain once per minute"
          >
            {[1, 2, 4].map((speed) => (
              <button
                className={world.speed === speed ? "active" : ""}
                key={speed}
                disabled={busy}
                onClick={() => void command("speed", speed)}
              >
                {speed}×
              </button>
            ))}
          </div>
          <div className="control-divider" />
          <button className="mode-control" onClick={() => setSettings(true)}>
            <span className="demo-leaf">
              <Leaf size={14} />
            </span>
            {world.mode === "demo" ? "Demo mode" : "Real AI"}
            <ChevronDown size={12} />
          </button>
        </div>
        {error && (
          <div
            className={`connection-note ${storage === "postgres" ? "warning" : ""}`}
            role="status"
          >
            {error}
          </div>
        )}
        <div className="north">
          <Compass size={25} strokeWidth={1} />
          <span>N</span>
        </div>
      </div>
      <footer className="page-footer">
        <span>
          <span className="footer-dot" />A small world with a life of its own.
        </span>
        <span>
          Made of little moments <span className="footer-spark">✳</span>
        </span>
      </footer>
      {settings && <Settings close={() => setSettings(false)} />}
    </main>
  );
}
