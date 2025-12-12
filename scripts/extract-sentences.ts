/**
 * Extract sentences from cached PMQ debates for LLM classification
 *
 * Reads cached debate files from scripts/.cache/ and extracts individual sentences
 * with metadata for later classification by Ollama.
 *
 * Usage: npx ts-node scripts/extract-sentences.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { shouldBlock, isPureQuestion } from './blocklist';

const CACHE_DIR = 'scripts/.cache';
const OUTPUT_FILE = 'scripts/sentences.json';

interface SpeechEntry {
  epobject_id: string;
  gid: string;
  hdate: string;
  body: string;
  speaker?: {
    name: string;
    party: string;
    constituency?: string;
  };
}

interface ExtractedSentence {
  id: string;
  text: string;
  date: string;
  speaker?: string;
  party?: string;
  count: number; // How many times this exact sentence appeared
  sources: Array<{
    date: string;
    speaker?: string;
    gid: string;
  }>;
}

/**
 * Strip HTML tags and decode entities
 */
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
    .replace(/&#163;/g, '£')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split text into sentences
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation, but be careful with abbreviations
  const sentences = text
    .replace(/([.!?])\s+/g, '$1|SPLIT|')
    .split('|SPLIT|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return sentences;
}

/**
 * Normalize sentence for deduplication
 */
function normalizeSentence(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get all debate cache files (the detailed speech files, not date summaries)
 */
function getDebateCacheFiles(): string[] {
  const files = fs.readdirSync(CACHE_DIR);
  return files
    .filter((f) => f.startsWith('debate-') && f.endsWith('.json') && !f.startsWith('debates-'))
    .map((f) => path.join(CACHE_DIR, f));
}

async function extractSentences(): Promise<void> {
  console.log('PMQ Sentence Extractor');
  console.log('======================\n');

  const cacheFiles = getDebateCacheFiles();
  console.log(`Found ${cacheFiles.length} cached debate files\n`);

  if (cacheFiles.length === 0) {
    console.error('No cached debate files found!');
    console.error('Run "npx ts-node scripts/analyze-pmq-phrases.ts" first to populate the cache.');
    process.exit(1);
  }

  // Map to deduplicate sentences (normalized text -> full data)
  const sentenceMap = new Map<string, ExtractedSentence>();
  let totalSentences = 0;
  let blockedSentences = 0;
  let questionSentences = 0;

  for (const cacheFile of cacheFiles) {
    const filename = path.basename(cacheFile);
    const speeches: SpeechEntry[] = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));

    console.log(`Processing ${filename}: ${speeches.length} speeches`);

    for (const speech of speeches) {
      if (!speech.body) continue;

      const text = stripHtml(speech.body);
      const sentences = splitIntoSentences(text);

      for (const sentence of sentences) {
        totalSentences++;

        // Apply blocklist
        if (shouldBlock(sentence)) {
          blockedSentences++;
          continue;
        }

        // Filter pure questions (keep rhetorical ones)
        if (isPureQuestion(sentence)) {
          questionSentences++;
          continue;
        }

        // Normalize for deduplication
        const normalized = normalizeSentence(sentence);
        if (normalized.length < 20) continue; // Too short after normalization

        const source = {
          date: speech.hdate,
          speaker: speech.speaker?.name,
          gid: speech.gid,
        };

        if (sentenceMap.has(normalized)) {
          // Update existing entry
          const existing = sentenceMap.get(normalized)!;
          existing.count++;
          existing.sources.push(source);
          // Update to most recent date
          if (speech.hdate > existing.date) {
            existing.date = speech.hdate;
            existing.speaker = speech.speaker?.name;
            existing.party = speech.speaker?.party;
          }
        } else {
          // New sentence
          const id = `s${sentenceMap.size + 1}`;
          sentenceMap.set(normalized, {
            id,
            text: sentence, // Keep original formatting
            date: speech.hdate,
            speaker: speech.speaker?.name,
            party: speech.speaker?.party,
            count: 1,
            sources: [source],
          });
        }
      }
    }
  }

  console.log('\n--- Statistics ---');
  console.log(`Total sentences processed: ${totalSentences}`);
  console.log(`Blocked by blocklist: ${blockedSentences}`);
  console.log(`Filtered questions: ${questionSentences}`);
  console.log(`Unique sentences extracted: ${sentenceMap.size}`);

  // Convert to array and sort by count (most frequent first)
  const sentences = Array.from(sentenceMap.values()).sort((a, b) => b.count - a.count);

  // Filter to sentences that appear at least twice (more likely to be rehearsed lines)
  const frequentSentences = sentences.filter((s) => s.count >= 2);
  const singleSentences = sentences.filter((s) => s.count === 1);

  console.log(`\nSentences appearing 2+ times: ${frequentSentences.length}`);
  console.log(`Sentences appearing once: ${singleSentences.length}`);

  // Output structure: frequent first, then sample of singles
  const output = {
    metadata: {
      extractedAt: new Date().toISOString(),
      totalProcessed: totalSentences,
      blocked: blockedSentences,
      questions: questionSentences,
      uniqueCount: sentenceMap.size,
    },
    // Frequent sentences (appear 2+ times) - prioritize these
    frequent: frequentSentences,
    // Sample of single-occurrence sentences (limit to 500 for manageability)
    single: singleSentences.slice(0, 500),
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nWritten to ${OUTPUT_FILE}`);
  console.log(`  - ${frequentSentences.length} frequent sentences`);
  console.log(`  - ${Math.min(singleSentences.length, 500)} single-occurrence sentences (capped)`);
}

extractSentences().catch(console.error);
