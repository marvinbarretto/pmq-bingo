/**
 * Blocklist for filtering out parliamentary formalities and procedural phrases
 * that are not suitable for PMQ Bingo (too common/formal, not funny)
 */

// Exact phrases to block (case-insensitive matching)
export const BLOCKED_PHRASES: string[] = [
  // Formal addresses
  'prime minister',
  'the prime minister',
  'deputy prime minister',
  'the deputy prime minister',
  'mr speaker',
  'madam speaker',
  'hon friend',
  'hon member',
  'hon gentleman',
  'hon lady',
  'my hon friend',
  'the hon member',
  'the hon gentleman',
  'the hon lady',
  'right hon',
  'the right hon',
  'right honourable',
  'the right honourable',
  'learned friend',
  'my learned friend',

  // Procedural
  'the house',
  'this house',
  'order order',
  'i refer',
  'i would refer',
  'question number',
  'question time',
  'i beg to move',
  'i give way',
  'i will give way',
  'i will not give way',

  // Generic parliamentary
  'the government',
  'this government',
  'the opposition',
  'the leader of the opposition',
  'the conservatives',
  'the labour party',
  'the liberal democrats',

  // Common but uninteresting
  'thank you',
  'i thank',
  'i welcome',
  'i agree',
  'i disagree',
  'as i said',
  'as i have said',
];

// Patterns to block (regex)
export const BLOCKED_PATTERNS: RegExp[] = [
  // Formal titles at start
  /^(mr|mrs|ms|dr|sir|dame|lord|lady|baron|baroness)\s/i,

  // Question/Order procedural
  /^(question|order|point of order)/i,

  // Simple acknowledgments
  /^(yes|no|indeed|absolutely|certainly|of course)[\s,\.!]?$/i,

  // Constituency mentions (often just "my constituency")
  /^(my|the)\s+constituency/i,

  // Numbers at start (usually procedural references)
  /^\d+/,

  // Very short interjections
  /^(hear hear|shame|oh|ah|well)[\s,\.!]?$/i,

  // References to specific dates/times
  /^(on|last|this)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
  /^(yesterday|today|tomorrow|last week|this week|next week)/i,

  // Standard PM opening statement
  /this morning i had meetings with ministerial colleagues/i,
  /i shall have further such meetings later today/i,
  /in addition to my duties in this house/i,

  // Speaker procedural calls
  /^i call the (leader|father|deputy|member)/i,
  /^i call (the )?hon/i,

  // Gratitude/tribute formulas (incomplete sentences)
  /^i (am grateful|pay tribute) to (my |the )?(hon|right)/i,
  /^i thank (my |the )?(hon|right)/i,
  /^may i (join|thank|congratulate)/i,
  /^i (will|shall) (make sure|ensure) that (my |the )/i,
  /^i will tell the right hon/i,
  /^let me give the right hon/i,

  // Incomplete sentence fragments (ending with titles)
  /\(.*\)\s*\.?$/i,  // Ends with (Name) or similar
  /(hon|right hon|member|gentleman|lady|friend)\.?\s*$/i,  // Ends with title

  // Specific date references in engagements
  /list his official engagements for/i,
  /if he will list/i,

  // Generic responses
  /^i have been asked to reply/i,
  /for raising this (really )?(important|vital) issue/i,
];

// Minimum content words required (excluding stopwords)
export const MIN_CONTENT_WORDS = 3;

// Sentence length bounds
export const MIN_SENTENCE_WORDS = 6;
export const MAX_SENTENCE_WORDS = 40;

/**
 * Check if a sentence should be blocked
 */
export function shouldBlock(sentence: string): boolean {
  const normalized = sentence.toLowerCase().trim();

  // Check exact phrases
  for (const phrase of BLOCKED_PHRASES) {
    if (normalized === phrase || normalized.startsWith(phrase + ' ') || normalized.endsWith(' ' + phrase)) {
      return true;
    }
  }

  // Check patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  // Check word count
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  if (words.length < MIN_SENTENCE_WORDS || words.length > MAX_SENTENCE_WORDS) {
    return true;
  }

  return false;
}

/**
 * Check if sentence is primarily a question (we want statements for bingo)
 */
export function isPureQuestion(sentence: string): boolean {
  const trimmed = sentence.trim();

  // Ends with question mark
  if (trimmed.endsWith('?')) {
    // But allow rhetorical questions that are really statements
    const rhetoricalStarters = [
      'is it not the case',
      'does he not agree',
      'does she not agree',
      'will he not accept',
      'will she not accept',
      "isn't it true",
      "isn't it the case",
      "doesn't he agree",
      "doesn't she agree",
    ];

    const lower = trimmed.toLowerCase();
    for (const starter of rhetoricalStarters) {
      if (lower.startsWith(starter)) {
        return false; // Keep rhetorical questions
      }
    }

    return true; // Block other questions
  }

  return false;
}
