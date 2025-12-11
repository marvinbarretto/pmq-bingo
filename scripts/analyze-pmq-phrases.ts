/**
 * PMQ Phrase Analyzer - N-gram based phrase discovery
 *
 * Fetches PMQ transcripts from TheyWorkForYou API (Commons only, Wednesdays)
 * and uses n-gram analysis to discover commonly used phrases.
 *
 * Caches API responses locally to avoid repeated calls.
 *
 * Usage: npx ts-node scripts/analyze-pmq-phrases.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const API_KEY = 'REDACTED_API_KEY';
const BASE_URL = 'https://www.theyworkforyou.com/api';
const CACHE_DIR = 'scripts/.cache';

interface DebateSection {
  entry: {
    gid: string;
    hdate: string;
    body: string;
    excerpt?: string;
  };
  subs: DebateSubsection[] | Record<string, never>;
}

interface DebateSubsection {
  gid: string;
  hdate: string;
  body: string;
  contentcount: string;
  excerpt?: string;
  listurl?: string;
}

interface SpeechEntry {
  gid: string;
  hdate: string;
  htime?: string;
  body: string;
  speaker?: {
    name: string;
    party: string;
  };
}

type DebatesResponse = DebateSection[];

// Common English stopwords
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'that', 'this', 'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she',
  'we', 'they', 'what', 'which', 'who', 'whom', 'when', 'where', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'if',
  'because', 'about', 'into', 'through', 'during', 'before', 'after',
  'any', 'our', 'your', 'their', 'his', 'her', 'my', 'me', 'him', 'them',
  'us', 'up', 'down', 'out', 'off', 'over', 'again', 'once',
  'said', 'says', 'say', 'get', 'got', 'going', 'go', 'went', 'come',
  'came', 'take', 'took', 'make', 'made', 'know', 'think', 'see', 'want',
  'give', 'use', 'find', 'tell', 'ask', 'work', 'seem', 'feel', 'try',
  'leave', 'call', 'keep', 'let', 'begin', 'show', 'hear', 'put',
]);

// Generic patterns to filter out
const GENERIC_PATTERNS = [
  /^(i|we|he|she|they|it)\s/i,
  /\s(is|are|was|were|be|been|being)\s*$/i,
  /^\d+/,
];

// Ensure cache directory exists
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Get cache filename for a date
function getCacheFile(date: string): string {
  return path.join(CACHE_DIR, `debates-${date}.json`);
}

// Check if we have cached data for a date
function getCachedData(date: string): DebatesResponse | null {
  const cacheFile = getCacheFile(date);
  if (fs.existsSync(cacheFile)) {
    const data = fs.readFileSync(cacheFile, 'utf-8');
    return JSON.parse(data);
  }
  return null;
}

// Save data to cache
function cacheData(date: string, data: DebatesResponse): void {
  const cacheFile = getCacheFile(date);
  fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
}

// Get Wednesdays from the last 6 months
function getWednesdays(monthsBack: number = 6): string[] {
  const wednesdays: string[] = [];
  const now = new Date();
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - monthsBack);

  const current = new Date(startDate);
  // Move to first Wednesday
  while (current.getDay() !== 3) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= now) {
    const dateStr = current.toISOString().split('T')[0];
    wednesdays.push(dateStr);
    current.setDate(current.getDate() + 7);
  }

  return wednesdays;
}

async function fetchDebatesForDate(date: string): Promise<DebatesResponse> {
  // Check cache first
  const cached = getCachedData(date);
  if (cached) {
    console.log(`  ${date}: Using cached data`);
    return cached;
  }

  const params = new URLSearchParams({
    key: API_KEY,
    type: 'commons',
    date: date,
    output: 'js',
  });

  const response = await fetch(`${BASE_URL}/getDebates?${params}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  // Cache the response
  cacheData(date, data);
  const sectionCount = Array.isArray(data) ? data.length : 0;
  console.log(`  ${date}: Fetched ${sectionCount} sections`);

  return data;
}

// Fetch actual speech content for a debate GID
async function fetchDebateContent(gid: string): Promise<SpeechEntry[]> {
  const cacheFile = path.join(CACHE_DIR, `debate-${gid.replace(/\./g, '-')}.json`);

  if (fs.existsSync(cacheFile)) {
    const data = fs.readFileSync(cacheFile, 'utf-8');
    return JSON.parse(data);
  }

  const params = new URLSearchParams({
    key: API_KEY,
    type: 'commons',
    gid: gid,
    output: 'js',
  });

  const response = await fetch(`${BASE_URL}/getDebates?${params}`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  const entries = Array.isArray(data) ? data : [];

  fs.writeFileSync(cacheFile, JSON.stringify(entries, null, 2));

  // Rate limit
  await new Promise((resolve) => setTimeout(resolve, 300));

  return entries;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

function extractNgrams(tokens: string[], n: number): string[] {
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

function isInterestingPhrase(phrase: string): boolean {
  const words = phrase.split(' ');

  // Must have at least one non-stopword
  const hasContentWord = words.some((w) => !STOPWORDS.has(w) && w.length > 2);
  if (!hasContentWord) return false;

  // Filter out generic patterns
  for (const pattern of GENERIC_PATTERNS) {
    if (pattern.test(phrase)) return false;
  }

  // Must not start or end with just stopwords
  if (STOPWORDS.has(words[0]) && STOPWORDS.has(words[words.length - 1])) {
    const middleWords = words.slice(1, -1);
    if (!middleWords.some((w) => !STOPWORDS.has(w) && w.length > 3)) {
      return false;
    }
  }

  return true;
}

// Find the PMQs GID from a day's debates
function findPMQsGid(sections: DebatesResponse): string | null {
  for (const section of sections) {
    // Look for "Prime Minister" section
    if (section.entry.body.toLowerCase() === 'prime minister') {
      // Get the "Engagements" subsection which is the actual PMQs
      if (Array.isArray(section.subs)) {
        for (const sub of section.subs) {
          if (sub.body.toLowerCase() === 'engagements') {
            return sub.gid;
          }
        }
      }
    }
  }
  return null;
}

async function analyzePhrases(): Promise<void> {
  console.log('PMQ Phrase Analyzer - Commons Wednesdays');
  console.log('========================================\n');

  ensureCacheDir();

  const phraseCounts: Map<string, number> = new Map();
  const phraseLastSeen: Map<string, string> = new Map();
  let pmqSessionsFound = 0;
  let totalSpeeches = 0;

  const wednesdays = getWednesdays(6);
  console.log(`Checking ${wednesdays.length} Wednesdays (last 6 months)...\n`);

  for (const date of wednesdays) {
    try {
      const sections = await fetchDebatesForDate(date);

      if (!Array.isArray(sections) || sections.length === 0) {
        continue;
      }

      // Find PMQs for this date
      const pmqGid = findPMQsGid(sections);
      if (!pmqGid) {
        console.log(`    No PMQs found for ${date}`);
        continue;
      }

      pmqSessionsFound++;
      console.log(`    Found PMQs: ${pmqGid}`);

      // Fetch the actual PMQ speeches
      const speeches = await fetchDebateContent(pmqGid);
      console.log(`    ${speeches.length} speeches`);

      for (const speech of speeches) {
        if (!speech.body) continue;
        totalSpeeches++;

        const text = stripHtml(speech.body);
        const tokens = tokenize(text);

        // Extract 2-grams, 3-grams, 4-grams
        for (let n = 2; n <= 4; n++) {
          const ngrams = extractNgrams(tokens, n);
          for (const ngram of ngrams) {
            if (isInterestingPhrase(ngram)) {
              phraseCounts.set(ngram, (phraseCounts.get(ngram) || 0) + 1);
              if (!phraseLastSeen.has(ngram) || date > phraseLastSeen.get(ngram)!) {
                phraseLastSeen.set(ngram, date);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`  Error for ${date}:`, error);
    }
  }

  console.log(`\nPMQ sessions found: ${pmqSessionsFound}`);
  console.log(`Total speeches analyzed: ${totalSpeeches}`);
  console.log(`Unique phrases found: ${phraseCounts.size}\n`);

  // Filter and sort by frequency
  const minCount = 3;
  const sortedPhrases = Array.from(phraseCounts.entries())
    .filter(([_, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 250);

  console.log('=== TOP 250 PMQ PHRASES ===\n');

  for (const [phrase, count] of sortedPhrases) {
    const lastSeen = phraseLastSeen.get(phrase) || 'N/A';
    console.log(`${count.toString().padStart(4)} | ${phrase} (${lastSeen})`);
  }

  // Generate phrase bank JSON
  const phraseBank = sortedPhrases.map(([phrase, count], index) => ({
    id: `p${index + 1}`,
    text: formatPhraseForDisplay(phrase),
    frequency: count,
    lastSeen: phraseLastSeen.get(phrase),
  }));

  const outputPath = 'public/data/phrase-bank.json';
  fs.writeFileSync(outputPath, JSON.stringify(phraseBank, null, 2));
  console.log(`\nWritten ${phraseBank.length} phrases to ${outputPath}`);
}

function formatPhraseForDisplay(phrase: string): string {
  const exceptions = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with']);

  return phrase
    .split(' ')
    .map((word, i) => {
      if (i === 0 || !exceptions.has(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(' ');
}

analyzePhrases().catch(console.error);
