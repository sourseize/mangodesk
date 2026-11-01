import { useMemo } from "react";
import { describeAction, toneFor } from "../domain/activityPresentation";
import type { ActivityEntry } from "../domain/workspace";

interface ActivityFeedProps {
  entries: ActivityEntry[];
  onOpenHistory: () => void;
}

const PREVIEW_SIZE = 5;

export function ActivityFeed({ entries, onOpenHistory }: ActivityFeedProps) {
  const latest = useMemo(
    () => [...entries]
      .sort((first, second) => new Date(second.occurredAt).getTime() - new Date(first.occurredAt).getTime())
      .slice(0, PREVIEW_SIZE),
    [entries],
  );

  return (
    <section className="activity-card" aria-labelledby="latest-moves-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THE PAPER TRAIL</p>
          <h2 id="latest-moves-heading">Latest moves</h2>
        </div>
        <span className="activity-count">{entries.length.toString().padStart(2, "0")}</span>
      </div>
      {latest.length === 0 ? (
        <p className="activity-empty">Your story starts with the first small win.</p>
      ) : (
        <ol className="activity-list">
          {latest.map((entry) => (
            <li key={entry.id}>
              <span className={`activity-dot dot-${toneFor(entry)}`} aria-hidden="true" />
              <div>
                <p><strong>{describeAction(entry)}</strong> {entry.title}</p>
                <time dateTime={entry.occurredAt}>{formatTime(entry.occurredAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button className="history-toggle" type="button" onClick={onOpenHistory}>
        View full history
        <span aria-hidden="true">↗</span>
      </button>
      <div className="local-note"><span aria-hidden="true">◈</span> Saved on your local server. Nothing leaves your machine.</div>
    </section>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  const sameDay = date.toDateString() === new Date().toDateString();
  return new Intl.DateTimeFormat(
    undefined,
    sameDay
      ? { hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  ).format(date);
}
