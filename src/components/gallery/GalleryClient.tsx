"use client";

import { useState } from "react";

import {
  initialRendererState,
  rendererReducer,
  SurfaceRenderer,
} from "@/components/classroom/SurfaceRenderer";
import type { A2UIActionMessage } from "@/lib/a2ui/messages";

import { GALLERY_FIXTURES } from "./fixtures";

/**
 * Dev-only widget gallery: renders every catalog widget from fixture A2UI JSON
 * through the real {@link SurfaceRenderer}, and echoes the action event each
 * interactive widget produces so the full round-trip is visible at a glance.
 */
export function GalleryClient() {
  const [lastAction, setLastAction] = useState<A2UIActionMessage | null>(null);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="border-b border-white/10 pb-4">
        <p className="text-xs uppercase tracking-widest text-white/40">
          Dev only
        </p>
        <h1 className="text-2xl font-semibold">Widget gallery</h1>
        <p className="mt-1 text-sm text-white/50">
          Every widget in the A2UI catalog, rendered from fixture JSON. Interact
          to see the action event each one emits.
        </p>
      </header>

      <div className="mt-8 space-y-10">
        {GALLERY_FIXTURES.map(({ name, message }) => {
          const state = rendererReducer(initialRendererState, message);
          return (
            <section key={name} className="space-y-3">
              <h2 className="text-xs uppercase tracking-widest text-white/40">
                {name}
              </h2>
              <SurfaceRenderer
                state={state}
                onAction={setLastAction}
                interactive
              />
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-10">
        <div className="rounded-xl border border-white/15 bg-black/80 p-3 text-xs backdrop-blur">
          <p className="mb-1 uppercase tracking-widest text-white/40">
            Last action event
          </p>
          {lastAction ? (
            <pre className="overflow-x-auto font-mono text-emerald-300">
              {JSON.stringify(lastAction, null, 2)}
            </pre>
          ) : (
            <p className="text-white/40">
              No action yet — interact with a widget above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
