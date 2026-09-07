import type { QuizBank } from "../quizTypes";

import { chatSystemQuiz } from "./chatSystem";
import { distributedCacheQuiz } from "./distributedCache";
import { distributedMessageQueueQuiz } from "./distributedMessageQueue";
import { fileStorageQuiz } from "./fileStorage";
import { keyValueStoreQuiz } from "./keyValueStore";
import { metricsMonitoringQuiz } from "./metricsMonitoring";
import { newsFeedQuiz } from "./newsFeed";
import { notificationSystemQuiz } from "./notificationSystem";
import { paymentSystemQuiz } from "./paymentSystem";
import { proximityServiceQuiz } from "./proximityService";
import { rateLimiterQuiz } from "./rateLimiter";
import { searchAutocompleteQuiz } from "./searchAutocomplete";
import { uniqueIdGeneratorQuiz } from "./uniqueIdGenerator";
import { urlShortenerQuiz } from "./urlShortener";
import { videoStreamingQuiz } from "./videoStreaming";
import { webCrawlerQuiz } from "./webCrawler";

/**
 * Hand-written quiz for every course, keyed by course slug.
 *
 * This is the non-generative half of practice: no model call, no session, no
 * account, so it works signed out and keeps working once a learner has spent
 * their daily generative-UI budget.
 */
export const QUIZ_BANK: QuizBank = {
  "url-shortener": urlShortenerQuiz,
  "rate-limiter": rateLimiterQuiz,
  "distributed-cache": distributedCacheQuiz,
  "key-value-store": keyValueStoreQuiz,
  "unique-id-generator": uniqueIdGeneratorQuiz,
  "web-crawler": webCrawlerQuiz,
  "notification-system": notificationSystemQuiz,
  "news-feed": newsFeedQuiz,
  "chat-system": chatSystemQuiz,
  "search-autocomplete": searchAutocompleteQuiz,
  "video-streaming": videoStreamingQuiz,
  "file-storage": fileStorageQuiz,
  "proximity-service": proximityServiceQuiz,
  "distributed-message-queue": distributedMessageQueueQuiz,
  "metrics-monitoring": metricsMonitoringQuiz,
  "payment-system": paymentSystemQuiz,
};

export function getQuiz(slug: string) {
  return QUIZ_BANK[slug] ?? [];
}
