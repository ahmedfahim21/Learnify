"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export interface SourceItem {
  id: string;
  kind: string;
  title: string;
  sourceUrl: string | null;
  status: string;
  error: string | null;
  tokenEstimate: number;
  canPasteTranscript: boolean;
  createdAt: string;
}

/** Heuristic: does this link look like a YouTube video? (mirrors parseYouTubeId) */
function looksLikeYouTube(url: string): boolean {
  return /(?:youtube\.com\/(?:watch|embed|shorts|live|v)|youtu\.be\/)/i.test(url);
}

const KIND_LABEL: Record<string, string> = {
  pdf: "PDF",
  url: "Article",
  youtube: "YouTube",
};

const STATUS_STYLE: Record<string, string> = {
  ready: "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200",
  ingesting: "border-amber-400/30 bg-amber-400/[0.08] text-amber-200",
  pending: "border-amber-400/30 bg-amber-400/[0.08] text-amber-200",
  failed: "border-red-400/30 bg-red-400/[0.08] text-red-200",
};

export function SourcesPanel({
  topicId,
  sources,
}: {
  topicId: string;
  sources: SourceItem[];
}) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function addLink() {
    const url = link.trim();
    if (!url) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/topics/${topicId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: looksLikeYouTube(url) ? "youtube" : "url",
          url,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't add that source.");
      setLink("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function addPdf(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/topics/${topicId}/sources`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't upload that PDF.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xs uppercase tracking-widest text-white/40">Sources</h2>
        <p className="text-sm text-white/50">
          Attach a PDF, an article URL, or a YouTube link so the tutor teaches
          from your material — not just what the model already knows.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addLink();
          }}
          placeholder="Paste an article or YouTube URL…"
          disabled={busy}
          className="flex-1 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm outline-none transition placeholder:text-white/30 focus:border-white/40 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void addLink()}
          disabled={busy || !link.trim()}
          className="rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium transition hover:bg-white/15 disabled:opacity-50"
        >
          Add link
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          className="rounded-lg border border-white/15 px-5 py-2.5 text-sm text-white/70 transition hover:border-white/40 disabled:opacity-50"
        >
          Upload PDF
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void addPdf(file);
          }}
        />
      </div>

      {busy && (
        <p className="text-sm text-white/50">Ingesting source… this can take a few seconds.</p>
      )}
      {error && (
        <p className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {sources.length > 0 && (
        <ul className="flex flex-col gap-2">
          {sources.map((source) => (
            <SourceRow key={source.id} topicId={topicId} source={source} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SourceRow({ topicId, source }: { topicId: string; source: SourceItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [transcript, setTranscript] = useState("");

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/topics/${topicId}/sources/${source.id}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function retry(manualTranscript?: string) {
    setBusy(true);
    try {
      await fetch(`/api/topics/${topicId}/sources/${source.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualTranscript ? { manualTranscript } : {}),
      });
      setPasting(false);
      setTranscript("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const statusClass = STATUS_STYLE[source.status] ?? STATUS_STYLE.pending;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <span className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-white/50">
              {KIND_LABEL[source.kind] ?? source.kind}
            </span>
            <span className="truncate text-sm text-white/80">{source.title}</span>
          </div>
          {source.status === "ready" && source.tokenEstimate > 0 && (
            <span className="text-xs text-white/40">
              ≈ {source.tokenEstimate.toLocaleString()} tokens
            </span>
          )}
          {source.status === "failed" && source.error && (
            <span className="text-xs text-red-200/80">{source.error}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded border px-2 py-0.5 text-[11px] capitalize ${statusClass}`}
          >
            {source.status}
          </span>
          {source.status === "failed" && !source.canPasteTranscript && (
            <button
              type="button"
              onClick={() => void retry()}
              disabled={busy}
              className="rounded border border-white/15 px-2.5 py-1 text-xs text-white/70 transition hover:border-white/40 disabled:opacity-50"
            >
              Retry
            </button>
          )}
          {source.canPasteTranscript && (
            <button
              type="button"
              onClick={() => setPasting((v) => !v)}
              disabled={busy}
              className="rounded border border-white/15 px-2.5 py-1 text-xs text-white/70 transition hover:border-white/40 disabled:opacity-50"
            >
              Paste transcript
            </button>
          )}
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="rounded border border-white/15 px-2.5 py-1 text-xs text-white/50 transition hover:border-red-400/40 hover:text-red-200 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>

      {pasting && (
        <div className="flex flex-col gap-2">
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
            placeholder="Paste the video transcript here…"
            className="w-full rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-sm outline-none transition placeholder:text-white/30 focus:border-white/40"
          />
          <button
            type="button"
            onClick={() => void retry(transcript.trim())}
            disabled={busy || !transcript.trim()}
            className="self-start rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/15 disabled:opacity-50"
          >
            {busy ? "Ingesting…" : "Use transcript"}
          </button>
        </div>
      )}
    </li>
  );
}
