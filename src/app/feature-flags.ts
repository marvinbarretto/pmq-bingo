/**
 * Feature flags for PMQ Bingo
 * Toggle features here before building.
 */
export const featureFlags = {
  /** Enable speech-to-text phrase detection (Vosk-based, experimental) */
  speechToText: false,
  /** Enable share functionality (Web Share API / clipboard) */
  share: false,
} as const;
