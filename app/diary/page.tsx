import type { Metadata } from "next";
import { connection } from "next/server";
import MoodFace from "@/components/ui/MoodFace";
import { getDb } from "@/lib/db";
import { getDiary } from "@/lib/db/queries";

export const metadata: Metadata = { title: "Object Diary · Objects Have Feelings" };

const TYPE_STYLE = { said: "bg-sun", heard: "bg-mint", event: "bg-peach" } as const;

/** FR-13: a timeline of everything each object said, heard and lived through. */
export default async function DiaryPage() {
  await connection(); // always read the live database
  const diary = getDiary(getDb());

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-bold sm:text-4xl">Object Diary</h1>
        <p className="text-ink-soft">Every word, every grudge, every time someone got moved without asking.</p>
      </header>
      {diary.length === 0 ? (
        <div className="card p-8 text-center" data-testid="diary-empty">
          <p className="font-display text-xl font-bold">The diary is empty.</p>
          <p className="text-ink-soft">Scan a photo on the Stage and your objects will start writing.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {diary.map((o) => (
            <article key={o.id} className="card p-4" data-testid="diary-object">
              <header className="mb-3 flex items-center gap-3">
                <MoodFace mood={o.mood} size={34} />
                <div>
                  <h2 className="text-xl font-bold leading-tight">{o.name}</h2>
                  <p className="text-sm text-ink-soft">the {o.label} · last seen {new Date(o.lastSeen).toLocaleString()}</p>
                </div>
              </header>
              {o.entries.length === 0 ? (
                <p className="text-sm text-ink-soft">Hasn&apos;t said a word yet.</p>
              ) : (
                <ol className="relative flex max-h-80 flex-col gap-2 overflow-y-auto border-l-[2.5px] border-dashed border-orange pl-4">
                  {o.entries.map((e) => (
                    <li key={e.id} className="text-sm">
                      <div className="flex items-center gap-2 text-xs text-ink-soft">
                        <span className={`rounded-full border-2 border-ink px-2 font-bold text-ink ${TYPE_STYLE[e.type]}`}>{e.type}</span>
                        <time dateTime={new Date(e.createdAt).toISOString()}>{new Date(e.createdAt).toLocaleString()}</time>
                      </div>
                      <p className={e.type === "said" ? "font-semibold" : ""}>{e.type === "said" ? `“${e.content}”` : e.content}</p>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
