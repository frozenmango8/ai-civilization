import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BookOpen,
  MessageSquare,
  Radio,
  ScrollText,
  Vote,
  X,
} from "lucide-react";
import { useTown } from "../store";
import type { CitizenWriting } from "../world/types";
import { providerName } from "./Stories";
const kindName = (kind: CitizenWriting["kind"]) =>
  ({
    diary: "Journal",
    post: "Public post",
    proposal: "Proposal",
    comment: "Comment",
  })[kind];
export function CitizenVoice() {
  const w = useTown((s) => s.world),
    selected = useTown((s) => s.selected),
    open = useTown((s) => s.openChronicle),
    observing = useTown((s) => s.observation);
  const c = w.citizens.find((c) => c.id === selected);
  if (!c || !observing) return null;
  const entry = w.writings?.find((e) => e.authorId === c.id);
  return (
    <section className="citizen-voice">
      <button
        className="voice-close"
        aria-label="Close citizen view"
        onClick={() => {
          useTown.getState().select(null);
          useTown.getState().follow(null);
        }}
      >
        <X size={14} />
      </button>
      <div className="voice-identity">
        <span className="voice-avatar" style={{ background: c.color }}>
          {c.name[0]}
        </span>
        <div>
          <strong>{c.name}</strong>
          <small>
            {providerName(c.provider)} ·{" "}
            {entry ? kindName(entry.kind) : c.action} ·{" "}
            {entry?.source === "ai"
              ? "Agent-authored"
              : entry?.source === "fallback"
                ? "Fallback writing"
                : entry
                  ? "Demo writing"
                  : "Latest action"}
          </small>
        </div>
        <Radio size={14} />
      </div>
      {entry ? (
        <>
          <h3>{entry.title}</h3>
          <p>
            {entry.body.length > 260
              ? entry.body.slice(0, 260) + "…"
              : entry.body}
          </p>
          <button onClick={() => open(entry.id)}>
            Read the full entry <ArrowRight size={13} />
          </button>
        </>
      ) : (
        <p>“{c.message}”</p>
      )}
    </section>
  );
}
export default function Chronicle() {
  const w = useTown((s) => s.world),
    open = useTown((s) => s.chronicleOpen),
    reading = useTown((s) => s.reading),
    close = useTown((s) => s.closeChronicle),
    select = useTown((s) => s.select),
    follow = useTown((s) => s.follow);
  const [tab, setTab] = useState<"public" | "diary" | "council">("public"),
    [author, setAuthor] = useState("all"),
    [detail, setDetail] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setDetail(reading);
      const entry = w.writings?.find((e) => e.id === reading);
      if (entry) {
        setTab(
          entry.kind === "diary"
            ? "diary"
            : entry.kind === "proposal" || entry.kind === "comment"
              ? "council"
              : "public",
        );
        setAuthor(entry.authorId);
      }
    }
  }, [open, reading]);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);
  if (!open) return null;
  const writings = (w.writings ?? []).filter(
    (e) =>
      (author === "all" || e.authorId === author) &&
      (tab === "diary"
        ? e.kind === "diary"
        : tab === "public"
          ? e.kind === "post"
          : e.kind === "proposal" || e.kind === "comment"),
  );
  const active = (w.writings ?? []).find((e) => e.id === detail);
  return createPortal(
    <div className="modal-backdrop archive-backdrop" onClick={close}>
      <section
        className="archive"
        role="dialog"
        aria-modal="true"
        aria-label="The living chronicle"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <span className="archive-kicker">
              <span />
              LIVE CIVILIZATION / SHARED MEMORY
            </span>
            <h2>The living chronicle</h2>
            <p>
              What citizens write, debate, and decide becomes part of their
              world.
            </p>
          </div>
          <button aria-label="Close chronicle" onClick={close}>
            <X size={20} />
          </button>
        </header>
        <nav>
          {(
            [
              ["public", "Public square", MessageSquare],
              ["diary", "Journals", BookOpen],
              ["council", "Town council", Vote],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setDetail(null);
                setAuthor("all");
              }}
            >
              <Icon size={15} />
              {label}
              <small>
                {id === "council"
                  ? (w.proposals ?? []).filter((p) => p.status === "open")
                      .length
                  : (w.writings ?? []).filter(
                      (e) => e.kind === (id === "public" ? "post" : "diary"),
                    ).length}
              </small>
            </button>
          ))}
        </nav>
        <div className="archive-layout">
          <aside>
            <label htmlFor="writing-author">Follow a voice</label>
            <select
              id="writing-author"
              value={author}
              onChange={(e) => {
                setAuthor(e.target.value);
                setDetail(null);
              }}
            >
              <option value="all">Everyone</option>
              {w.citizens.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {providerName(c.provider)}
                </option>
              ))}
            </select>
            <p>
              Entries come from citizens’ simulation actions. Reading makes no
              AI calls.
            </p>
            <div className="archive-note">
              <ScrollText size={19} />
              <strong>A persistent history</strong>
              <p>
                The latest five pieces per citizen are retained with their
                authorship source.
              </p>
            </div>
          </aside>
          <div className="archive-content">
            {tab === "council" && (
              <div className="council-proposals">
                {(w.proposals ?? [])
                  .filter((p) => author === "all" || p.authorId === author)
                  .map((p) => {
                    const c = w.citizens.find((c) => c.id === p.authorId),
                      yes = Object.values(p.votes).filter(
                        (v) => v === "yes",
                      ).length,
                      no = Object.values(p.votes).filter(
                        (v) => v === "no",
                      ).length;
                    return (
                      <article
                        className={`proposal-card ${p.status}`}
                        key={p.id}
                      >
                        <div>
                          <span className="entry-kind">
                            {p.status === "open"
                              ? `VOTING OPEN · ${Math.max(0, p.closesAt - w.tick)} TICKS LEFT`
                              : p.status.toUpperCase()}
                          </span>
                          <small>
                            {c?.name} · {p.priority} ·{" "}
                            {p.source === "ai"
                              ? "AI-authored"
                              : p.source === "fallback"
                                ? "Fallback"
                                : "Demo"}
                          </small>
                        </div>
                        <h3>{p.title}</h3>
                        <p>{p.body}</p>
                        <div className="vote-meter">
                          <span style={{ width: `${(yes / 20) * 100}%` }} />
                          <i style={{ width: `${(no / 20) * 100}%` }} />
                        </div>
                        <footer>
                          <span>
                            {yes} yes · {no} no · {20 - yes - no} not voted
                          </span>
                          <small>8 voters + majority required</small>
                        </footer>
                      </article>
                    );
                  })}
                {!(w.proposals ?? []).length && (
                  <div className="archive-empty">
                    <Vote size={34} />
                    <h3>The council floor is open.</h3>
                    <p>
                      Citizens can propose a priority, debate it, and vote.
                      Passed proposals govern the town for two days.
                    </p>
                  </div>
                )}
              </div>
            )}
            {writings
              .filter((e) => tab !== "council" || e.kind === "comment")
              .map((e) => {
                const c = w.citizens.find((c) => c.id === e.authorId),
                  expanded = active?.id === e.id;
                return (
                  <article
                    key={e.id}
                    className={`writing-card ${expanded ? "expanded" : ""}`}
                  >
                    <div className="writing-meta">
                      <span
                        className="writing-avatar"
                        style={{ background: c?.color }}
                      >
                        {c?.name[0]}
                      </span>
                      <div>
                        <strong>{c?.name}</strong>
                        <small>
                          {providerName(c?.provider ?? "terra")} · Tick {e.tick}{" "}
                          · {kindName(e.kind)}
                        </small>
                      </div>
                      <span className={`authorship ${e.source}`}>
                        {e.source === "ai"
                          ? "AI-authored"
                          : e.source === "fallback"
                            ? "Fallback writing"
                            : "Demo writing"}
                      </span>
                    </div>
                    <button
                      className="entry-title"
                      onClick={() => setDetail(expanded ? null : e.id)}
                    >
                      <h3>{e.title}</h3>
                    </button>
                    <p>
                      {expanded
                        ? e.body
                        : e.body.slice(0, 190) +
                          (e.body.length > 190 ? "…" : "")}
                    </p>
                    <footer>
                      <button onClick={() => setDetail(expanded ? null : e.id)}>
                        {expanded ? "Collapse" : "Read entry"}
                        <ArrowRight size={12} />
                      </button>
                      <button
                        onClick={() => {
                          if (c) {
                            select(c.id);
                            follow(c.id);
                            close();
                          }
                        }}
                      >
                        Visit {c?.name}
                        <ArrowRight size={12} />
                      </button>
                    </footer>
                  </article>
                );
              })}
            {!writings.length && tab !== "council" && (
              <div className="archive-empty">
                <BookOpen size={34} />
                <h3>
                  {tab === "diary"
                    ? "Every life needs a first page."
                    : "The town is still finding its voice."}
                </h3>
                <p>
                  Citizens can choose to{" "}
                  {tab === "diary"
                    ? "reflect at their desks"
                    : "publish their experiences"}{" "}
                  on their next decision. No entries are invented just by
                  opening this view.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="archive-footer">
          A record of twenty fictional lives, written one decision at a time.
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function ObservationControls() {
  const observing = useTown((s) => s.observation),
    world = useTown((s) => s.world),
    following = useTown((s) => s.following),
    follow = useTown((s) => s.follow),
    select = useTown((s) => s.select),
    reset = useTown((s) => s.resetCamera),
    open = useTown((s) => s.openChronicle),
    snapshot = useTown((s) => s.snapshot);
  if (!observing) return null;
  const index = world.citizens.findIndex((c) => c.id === following);
  const next = () => {
    const c = world.citizens[(index + 1) % 20];
    select(c.id);
    follow(c.id);
  };
  return (
    <>
      <div className="world-identity">
        <span className="identity-live" />
        <div>
          <strong>Sol × Sonnet world</strong>
          <small
            title={snapshot?.providers
              .map((p) => p.model ?? "Not configured")
              .join(" / ")}
          >
            20 lives ·{" "}
            {world.mode === "ai" ? "AI simulation" : "Free simulation"}
          </small>
        </div>
        <span className="identity-version">LIVE</span>
      </div>
      <div className="observe-tools">
        <button onClick={next}>
          <Radio size={14} />
          {following ? "Next citizen" : "Follow a citizen"}
          <ArrowRight size={12} />
        </button>
        <button onClick={reset}>Overview</button>
        <button onClick={() => open()}>
          <BookOpen size={14} />
          Read the world
        </button>
      </div>
    </>
  );
}
