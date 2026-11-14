import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
function ModalPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
import {
  ArrowRight,
  Flag,
  Hammer,
  Heart,
  Leaf,
  Play,
  ScrollText,
  Sparkles,
  X,
} from "lucide-react";
import { useTown } from "../store";
import { projects, projectIssue } from "../world/projects";
import type { Provider } from "../world/types";
export const providerName = (p: Provider) => (p === "terra" ? "Sol" : "Sonnet");
const signed = (n: number) => `${n > 0 ? "+" : ""}${Math.round(n)}`;
function watch(id: string) {
  const s = useTown.getState();
  s.select(id);
  s.follow(id);
}
export function TownProgress() {
  const w = useTown((s) => s.world),
    [open, setOpen] = useState(false),
    command = useTown((s) => s.command),
    busy = useTown((s) => s.busy),
    error = useTown((s) => s.error),
    storage = useTown((s) => s.storage),
    admin = useTown((s) => s.admin);
  const challenge = w.challenge;
  const rivalry = w.citizens
    .flatMap((c) =>
      Object.entries(c.relationships)
        .filter(([, score]) => score < 0)
        .map(([id, score]) => ({
          c,
          other: w.citizens.find((p) => p.id === id),
          score,
        })),
    )
    .sort((a, b) => a.score - b.score)[0];
  return (
    <>
      <section
        className={`town-purpose ${challenge?.status === "active" ? "urgent" : ""}`}
      >
        <span className="eyebrow">
          {challenge?.status === "active"
            ? `Town challenge · ${Math.max(0, challenge.deadline - w.tick)} ticks left`
            : "The next chapter"}
        </span>
        <h2>
          {challenge?.status === "active"
            ? challenge.title
            : w.construction >= 100
              ? "A town worth belonging to"
              : "Build a place for big ideas."}
        </h2>
        <p>
          {challenge?.status === "active"
            ? challenge.description
            : w.construction >= 100
              ? "Grow friendships. Win support. See who becomes mayor."
              : "The library needs timber, workers, and someone willing to invest in the future."}
        </p>
        <div className="purpose-progress">
          <span
            style={{
              width: `${challenge?.status === "active" ? (challenge.progress / challenge.target) * 100 : w.construction}%`,
            }}
          />
        </div>
        <div className="purpose-bottom">
          <small>
            {challenge?.status === "active"
              ? `${challenge.progress} / ${challenge.target} helpful actions`
              : `Library ${w.construction}% complete`}
          </small>
          <button onClick={() => setOpen(true)}>
            Shape the town <ArrowRight size={12} />
          </button>
        </div>
        {rivalry?.other && (
          <button className="town-rivalry" onClick={() => watch(rivalry.c.id)}>
            <span />
            {rivalry.c.name} & {rivalry.other.name}:{" "}
            {rivalry.score <= -35 ? "a bitter rivalry" : "trust is slipping"}{" "}
            <ArrowRight size={11} />
          </button>
        )}
      </section>
      {open && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <section
              className="modal project-modal panel"
              role="dialog"
              aria-modal="true"
              aria-label="Shape the town"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="icon-btn close"
                aria-label="Close projects"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
              <span className="eyebrow">You have a part in this story</span>
              <h2>Shape the town</h2>
              <p className="muted">
                Spend the town’s resources to change what happens next. These
                choices make no AI calls.
              </p>
              <div className="project-wallet">
                {Math.floor(w.gold)} gold <span>·</span> {w.wood} wood
              </div>
              <div className="political-race">
                <span className="eyebrow">
                  {w.electionRequested
                    ? "Election next tick"
                    : "The race for town hall"}
                </span>
                <p>
                  Mayor {w.citizens.find((c) => c.id === w.mayor)?.name} ·{" "}
                  {Math.round(w.tax * 100)}% tax · {w.priority}
                </p>
                {w.candidates.length ? (
                  w.candidates.map((id) => {
                    const c = w.citizens.find((c) => c.id === id);
                    if (!c) return null;
                    const friends = w.citizens.filter(
                      (p) => (p.relationships[id] ?? 0) > 0,
                    ).length;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          watch(id);
                          setOpen(false);
                        }}
                      >
                        <strong>
                          <span className={`dot ${c.provider}`} />
                          {c.name}
                          <small>{friends} friendly connections</small>
                        </strong>
                        <p>
                          “
                          {w.campaignPromises?.[id] ??
                            "A new campaign is taking shape."}
                          ”
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <p className="muted">
                    No challengers yet. Citizens can choose to campaign on their
                    next decision.
                  </p>
                )}
              </div>
              {projects.map((p, i) => {
                const issue = projectIssue(w, p.id);
                return (
                  <article className="project-option" key={p.id}>
                    <span className="project-icon">
                      {i === 0 ? (
                        <Heart size={20} />
                      ) : i === 1 ? (
                        <Leaf size={20} />
                      ) : (
                        <Hammer size={20} />
                      )}
                    </span>
                    <div>
                      <h3>{p.name}</h3>
                      <p>{p.description}</p>
                      <button
                        disabled={
                          busy || !!issue || (storage === "postgres" && !admin)
                        }
                        title={issue ?? undefined}
                        onClick={() => void command("project", p.id)}
                      >
                        {issue ??
                          (storage === "postgres" && !admin
                            ? "Enter operator secret in settings"
                            : p.cost)}
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </article>
                );
              })}
              {error && (
                <p className="project-error" role="status">
                  {error}
                </p>
              )}
              <p className="muted">
                Shared town projects require the operator secret in Town
                settings. Your existing civilization and daily API budget stay
                intact.
              </p>
            </section>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
export function StoryDock() {
  const w = useTown((s) => s.world),
    [open, setOpen] = useState(false),
    [filter, setFilter] = useState<"all" | Provider>("all");
  const report = w.lastTick;
  const headline =
    report?.decisions.find((d) =>
      ["steal", "campaign", "alliance", "help"].includes(d.action),
    ) ?? report?.decisions[0];
  return (
    <>
      <div className="story-dock panel">
        <span className="story-symbol">
          <ScrollText size={17} />
        </span>
        <button className="story-open" onClick={() => setOpen(true)}>
          <strong>
            {report
              ? `Tick ${report.tick}: twenty choices, real consequences`
              : "What are they doing?"}
          </strong>
          <span>
            {headline?.summary ??
              "Watch a citizen, or advance a tick to start the next chapter."}
          </span>
        </button>
        {headline && (
          <button
            className="watch-scene"
            onClick={() => watch(headline.citizenId)}
            aria-label="Watch the latest story"
            title="Watch this citizen"
          >
            <Play size={13} fill="currentColor" />
          </button>
        )}
        <button
          className="story-details"
          onClick={() => setOpen(true)}
          aria-label="Open tick recap"
        >
          Recap <ArrowRight size={13} />
        </button>
      </div>
      {open && (
        <ModalPortal>
          <div className="modal-backdrop" onClick={() => setOpen(false)}>
            <section
              className="modal journal panel"
              role="dialog"
              aria-modal="true"
              aria-label="What happened this tick"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="icon-btn close"
                aria-label="Close tick recap"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
              <span className="eyebrow">The story behind the numbers</span>
              <h2>
                {report
                  ? `What happened in tick ${report.tick}?`
                  : "The next chapter starts with a tick."}
              </h2>
              {report ? (
                <>
                  <div className="recap-deltas">
                    {[
                      [report.food, "food"],
                      [report.gold, "gold"],
                      [report.wood, "wood"],
                      [report.construction, "library %"],
                      [report.happiness, "happiness"],
                    ].map(([n, label]) => (
                      <div key={label}>
                        <strong className={Number(n) < 0 ? "negative" : ""}>
                          {signed(Number(n))}
                        </strong>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="decision-providers">
                    {(["terra", "sonnet"] as const).map((p) => {
                      const status = report.providers[p];
                      return (
                        <div
                          className={
                            status?.status === "fallback"
                              ? "provider-warning"
                              : ""
                          }
                          key={p}
                        >
                          <strong>
                            <span className={`dot ${p}`} />
                            {providerName(p)}
                            <small>
                              {status?.status === "ai"
                                ? "AI decisions used"
                                : status?.status === "fallback"
                                  ? "Fallback decisions used"
                                  : "Free simulation"}
                            </small>
                          </strong>
                          <p>{status?.detail ?? "No result recorded"}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="recap-tabs">
                    {(["all", "terra", "sonnet"] as const).map((p) => (
                      <button
                        key={p}
                        className={filter === p ? "active" : ""}
                        onClick={() => setFilter(p)}
                      >
                        {p === "all" ? "All 20 citizens" : providerName(p)}
                      </button>
                    ))}
                  </div>
                  <div className="decision-list">
                    {report.decisions
                      .filter(
                        (d) =>
                          filter === "all" ||
                          w.citizens.find((c) => c.id === d.citizenId)
                            ?.provider === filter,
                      )
                      .map((d) => {
                        const citizen = w.citizens.find(
                          (c) => c.id === d.citizenId,
                        );
                        return (
                          <button
                            key={d.citizenId}
                            onClick={() => {
                              watch(d.citizenId);
                              setOpen(false);
                            }}
                          >
                            <span
                              className="decision-avatar"
                              style={{ background: citizen?.color }}
                            >
                              {citizen?.name[0]}
                            </span>
                            <div>
                              <strong>
                                {citizen?.name}
                                <small>
                                  {d.action} ·{" "}
                                  {d.source === "ai"
                                    ? "AI"
                                    : d.source === "fallback"
                                      ? "fallback"
                                      : "demo"}
                                </small>
                              </strong>
                              <p>{d.summary}</p>
                              <blockquote>
                                “{d.message ?? citizen?.message}”
                              </blockquote>
                            </div>
                            <ArrowRight size={14} />
                          </button>
                        );
                      })}
                  </div>
                </>
              ) : (
                <p className="muted">
                  Existing saves are compatible. The next tick records each
                  citizen’s action, its result, and whether it came from AI or
                  fallback behavior.
                </p>
              )}
              <p className="muted">
                Click a story to go straight to its citizen. Opening this recap
                makes no AI calls.
              </p>
            </section>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
export function DecisionOrigin({ id }: { id: string }) {
  const citizen = useTown((s) => s.world.citizens.find((c) => c.id === id));
  const report = useTown((s) => s.world.lastTick),
    d = report?.decisions.find((d) => d.citizenId === id);
  if (citizen?.playerDirected)
    return (
      <div className="decision-origin player">
        <span>
          <Flag size={13} />
          Your festival
        </span>
        <p>You brought the town together at the square.</p>
      </div>
    );
  if (!d) return null;
  return (
    <div className={`decision-origin ${d.source}`}>
      <span>
        {d.source === "ai" ? <Sparkles size={13} /> : <Flag size={13} />}{" "}
        {d.source === "ai"
          ? "AI chose this"
          : d.source === "fallback"
            ? "Fallback chose this"
            : "Demo decision"}
      </span>
      <p>{d.summary}</p>
    </div>
  );
}
