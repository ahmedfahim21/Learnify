"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The official video in YouTube's IFrame player, wrapped for the lecture page.
 *
 * Loads the IFrame API once per page (queuing behind any other caller), and
 * exposes play/pause/seek plus a `sample()` the page polls for the checkpoint
 * clock. Seeks made through this hook are timestamped so the clock can tell
 * the player's own replay jumps from the student scrubbing.
 *
 * YouTube's own caption layer is unloaded on play, so it doesn't duplicate
 * Learnify's subtitle bar over the slides.
 *
 * An owner can block embedding (YouTube error 101/150); that surfaces as
 * `blocked`, so the page can link out instead of showing a dead frame.
 */

interface YTPlayer {
  getCurrentTime(): number;
  getPlaybackRate(): number;
  getPlayerState(): number;
  seekTo(sec: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  destroy(): void;
  /** Not in YouTube's typed docs, but the long-standing way to drop its caption layer. */
  unloadModule?(name: string): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars: Record<string, number | string>;
      events: { onReady?: () => void; onStateChange?: (e: { data: number }) => void; onError?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** YT.PlayerState values. */
export const PLAYING = 1;
export const BUFFERING = 3;

let apiReady: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  apiReady ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiReady = null;
      reject(new Error("Couldn't load YouTube's player. Check your connection and reload."));
    };
    document.head.appendChild(script);
  });
  return apiReady;
}

export interface PlayerSample {
  timeSec: number;
  rate: number;
  playing: boolean;
  /** performance.now() of the sample. */
  at: number;
  /** performance.now() of the last seek this hook made. */
  lastOwnSeekAt: number;
}

export interface YouTubePlayer {
  containerRef: React.RefObject<HTMLDivElement | null>;
  ready: boolean;
  playing: boolean;
  /** The owner blocked embedding, or the video was removed. */
  blocked: boolean;
  error: string | null;
  play: () => void;
  pause: () => void;
  seek: (sec: number, opts?: { play?: boolean }) => void;
  sample: () => PlayerSample | null;
}

export function useYouTubePlayer(videoId: string | null): YouTubePlayer {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const player = useRef<YTPlayer | null>(null);
  const lastOwnSeekAt = useRef(-Infinity);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoId || !containerRef.current) return;
    let cancelled = false;
    const mount = document.createElement("div");
    containerRef.current.replaceChildren(mount);

    loadApi().then(
      (YT) => {
        if (cancelled) return;
        player.current = new YT.Player(mount, {
          videoId,
          playerVars: { rel: 0, cc_load_policy: 0, iv_load_policy: 3, modestbranding: 1, playsinline: 1, enablejsapi: 1 },
          events: {
            onReady: () => !cancelled && setReady(true),
            onStateChange: (e) => {
              if (cancelled) return;
              setPlaying(e.data === PLAYING);
              // Learnify draws its own subtitles under the video. cc_load_policy=0
              // can't override a viewer's YouTube caption preference, so drop
              // YouTube's caption layer once playback has loaded it.
              if (e.data === PLAYING) player.current?.unloadModule?.("captions");
            },
            onError: (e) => {
              if (cancelled) return;
              if (e.data === 101 || e.data === 150 || e.data === 100) setBlocked(true);
              else setError(`YouTube couldn't play this video (error ${e.data}).`);
            },
          },
        });
      },
      (err: Error) => !cancelled && setError(err.message),
    );

    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      setReady(false);
      setPlaying(false);
    };
  }, [videoId]);

  const play = useCallback(() => player.current?.playVideo(), []);
  const pause = useCallback(() => player.current?.pauseVideo(), []);
  const seek = useCallback((sec: number, opts: { play?: boolean } = {}) => {
    const p = player.current;
    if (!p) return;
    lastOwnSeekAt.current = performance.now();
    p.seekTo(Math.max(0, sec), true);
    if (opts.play) p.playVideo();
  }, []);

  const sample = useCallback((): PlayerSample | null => {
    const p = player.current;
    if (!p || !ready) return null;
    const state = p.getPlayerState();
    return {
      timeSec: p.getCurrentTime(),
      rate: p.getPlaybackRate(),
      playing: state === PLAYING,
      at: performance.now(),
      lastOwnSeekAt: lastOwnSeekAt.current,
    };
  }, [ready]);

  return { containerRef, ready, playing, blocked, error, play, pause, seek, sample };
}
