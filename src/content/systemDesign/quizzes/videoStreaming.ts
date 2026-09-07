import type { QuizQuestion } from "../quizTypes";

export const videoStreamingQuiz: QuizQuestion[] = [
  {
    id: "vs-1",
    phase: "requirements",
    question: "Why isn't the uploaded file what actually gets streamed?",
    options: [
      { id: "a", label: "The original is usually corrupted" },
      { id: "b", label: "Playback must adapt to wildly different devices and bandwidths, which needs multiple encodings" },
      { id: "c", label: "Copyright requires re-encoding" },
      { id: "d", label: "Original files can't be served over HTTP" },
    ],
    correctOptionId: "b",
    explanation:
      "One file can't serve a phone on 3G and a TV on fibre. Transcoding into several bitrate renditions is what makes adaptive playback possible at all.",
  },
  {
    id: "vs-2",
    phase: "estimation",
    question: "At this scale, which cost dominates?",
    options: [
      { id: "a", label: "Storage — every rendition is kept forever" },
      { id: "b", label: "Bandwidth — storage is paid once, but every view re-consumes egress" },
      { id: "c", label: "Transcoding CPU" },
      { id: "d", label: "Database queries for metadata" },
    ],
    correctOptionId: "b",
    explanation:
      "A video stored once might be viewed a million times, making egress thousands of times the storage cost. That ratio is precisely what a CDN exists to attack.",
  },
  {
    id: "vs-3",
    phase: "api",
    question: "Why does upload return immediately with a 'processing' status?",
    options: [
      { id: "a", label: "To avoid holding a database transaction open" },
      { id: "b", label: "Transcoding can take longer than the video itself, so the uploader can't wait on it" },
      { id: "c", label: "The file must be virus-scanned first" },
      { id: "d", label: "Metadata isn't known until playback" },
    ],
    correctOptionId: "b",
    explanation:
      "Encoding multiple renditions is CPU-heavy and slow. Accepting the file, returning an id, and processing asynchronously keeps the upload responsive and lets the pipeline scale independently.",
  },
  {
    id: "vs-4",
    phase: "deep-dive",
    question: "In adaptive bitrate streaming, who chooses the next chunk's quality?",
    options: [
      { id: "a", label: "The server, from the client's declared connection type" },
      { id: "b", label: "The CDN edge, from regional congestion" },
      { id: "c", label: "The player, from its own measured download throughput" },
      { id: "d", label: "It's fixed when playback begins" },
    ],
    correctOptionId: "c",
    explanation:
      "The player times each chunk's download against its playback duration to estimate bandwidth, then picks the highest rendition it can sustain next. Because every rendition already sits on the edge, switching needs no renegotiation.",
  },
  {
    id: "vs-5",
    phase: "bottlenecks",
    question: "What falls behind first under a burst of uploads?",
    options: [
      { id: "a", label: "The CDN edge cache" },
      { id: "b", label: "The transcoding pipeline" },
      { id: "c", label: "The manifest service" },
      { id: "d", label: "Origin storage writes" },
    ],
    correctOptionId: "b",
    explanation:
      "Playback is served from edges and scales well; transcoding is CPU-bound and can take longer than real time per video. It needs its own horizontally-scaled worker pool so an upload burst becomes a longer queue, not a rejected upload.",
  },
];
