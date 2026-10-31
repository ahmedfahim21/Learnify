/**
 * Fetch an NPTEL caption file.
 *
 * A lesson's `vtt_url` entries come in two forms: a Google Drive file id
 * (older courses) or a `gs://` path in SWAYAM's public bucket (newer ones).
 * Both come from NPTEL's payload, so they are validated before they go
 * anywhere near a URL, and only fixed hosts and that one bucket are allowed.
 * Drive answers quota and virus-scan interstitials with HTTP 200 and an HTML
 * page, so a body is only accepted if it really is WebVTT.
 */

const DRIVE_ID = /^[A-Za-z0-9_-]{10,100}$/;
const SWAYAM_BUCKET = "swayam-node1-production.appspot.com";
const GS_PATH = /^gs:\/\/swayam-node1-production\.appspot\.com\/((?:[\w-][\w.-]*\/)*[\w-][\w.-]*\.vtt)$/;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

export class VttFetchError extends Error {
  constructor(
    readonly ref: string,
    readonly reason: string,
    readonly status?: number,
  ) {
    super(`NPTEL VTT ${ref}: ${reason}${status ? ` (HTTP ${status})` : ""}`);
    this.name = "VttFetchError";
  }
}

/** Turn a `vtt_url` value into the one URL we are willing to fetch it from. */
export function vttDownloadUrl(ref: string): string {
  const gs = ref.match(GS_PATH);
  if (gs) return `https://storage.googleapis.com/${SWAYAM_BUCKET}/${gs[1]}`;
  if (DRIVE_ID.test(ref)) return `https://drive.google.com/uc?export=download&id=${ref}`;
  throw new VttFetchError(ref, "unrecognised caption reference");
}

/** Accept only Google's own download hosts after redirects. */
function isGoogleHost(url: string): boolean {
  const host = new URL(url).hostname;
  return (
    host === "storage.googleapis.com" ||
    host === "drive.google.com" ||
    host === "drive.usercontent.google.com" ||
    host.endsWith(".googleusercontent.com")
  );
}

export async function fetchNptelVtt(ref: string): Promise<string> {
  let url = vttDownloadUrl(ref);

  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new VttFetchError(ref, "redirect without location", res.status);
      url = new URL(next, url).toString();
      if (!isGoogleHost(url)) throw new VttFetchError(ref, `redirect to foreign host ${url}`);
      continue;
    }
    if (!res.ok) throw new VttFetchError(ref, "download failed", res.status);

    const length = Number(res.headers.get("content-length"));
    if (length > MAX_BYTES) throw new VttFetchError(ref, `file too large (${length} bytes)`);
    const body = await res.text();
    if (body.length > MAX_BYTES) throw new VttFetchError(ref, "file too large");
    if (!body.replace(/^﻿/, "").startsWith("WEBVTT")) {
      throw new VttFetchError(ref, "response is not WebVTT (Drive quota or interstitial page)");
    }
    return body;
  }
  throw new VttFetchError(ref, "too many redirects");
}
