/**
 * Classify extracted sentences using Ollama (local LLM)
 *
 * Reads sentences.json and classifies each sentence as "bingo-worthy" or not
 * using llama3.2 running locally via Ollama.
 *
 * Usage: npx ts-node scripts/classify-sentences.ts
 *
 * Prerequisites:
 *   - Ollama installed: brew install ollama
 *   - Ollama running: ollama serve
 *   - Model pulled: ollama pull llama3.2
 */

import * as fs from 'fs';
import { Ollama } from 'ollama';

const INPUT_FILE = 'scripts/sentences.json';
const OUTPUT_FILE = 'scripts/candidates.json';
const MODEL = 'llama3.2';

// Parse --limit flag from command line
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

interface ExtractedSentence {
  id: string;
  text: string;
  date: string;
  speaker?: string;
  party?: string;
  count: number;
  sources: Array<{
    date: string;
    speaker?: string;
    gid: string;
  }>;
}

interface SentencesFile {
  metadata: {
    extractedAt: string;
    totalProcessed: number;
    blocked: number;
    questions: number;
    uniqueCount: number;
  };
  frequent: ExtractedSentence[];
  single: ExtractedSentence[];
}

interface ClassificationResult {
  bingoWorthy: boolean;
  confidence: number;
  category: 'attack' | 'deflection' | 'boast' | 'pledge' | 'cliche' | null;
}

interface Candidate {
  id: string;
  text: string;
  confidence: number;
  category: string | null;
  frequency: number;
  lastSeen: string;
  speaker?: string;
  party?: string;
  approved?: boolean;
  sources: Array<{
    date: string;
    speaker?: string;
  }>;
}

const CLASSIFICATION_PROMPT = `You are analysing sentences from UK Prime Minister's Questions (PMQs) for a "PMQ Bingo" game.

Your task: Determine if this sentence is a "bingo-worthy" rehearsed political line, cliché, or catchphrase that viewers would recognize and find amusing.

GOOD examples (bingo-worthy):
- "Let me be absolutely clear"
- "The party opposite has no plan"
- "We are delivering for working people"
- "Under the previous government"
- "Long-term economic plan"
- "Magic money tree"
- "Get Brexit done"
- "Strong and stable"

BAD examples (NOT bingo-worthy):
- Procedural statements ("I refer to my previous answer")
- Specific policy details with numbers/dates
- Constituency-specific mentions
- Simple acknowledgments
- Generic parliamentary language

Categories:
- attack: Criticism of opponents
- deflection: Avoiding the question
- boast: Self-congratulation about achievements
- pledge: Promise to do something
- cliche: Overused phrase or soundbite

Sentence: "{sentence}"

Reply with ONLY valid JSON (no explanation):
{{"bingoWorthy": true/false, "confidence": 0.0-1.0, "category": "attack|deflection|boast|pledge|cliche|null"}}`;

async function classifySentence(ollama: Ollama, sentence: string): Promise<ClassificationResult | null> {
  try {
    const prompt = CLASSIFICATION_PROMPT.replace('{sentence}', sentence.replace(/"/g, '\\"'));

    const response = await ollama.chat({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      format: 'json',
    });

    const content = response.message.content.trim();

    // Parse JSON response
    const result = JSON.parse(content);

    return {
      bingoWorthy: Boolean(result.bingoWorthy),
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
      category: result.category || null,
    };
  } catch (error) {
    console.error(`  Error classifying sentence: ${error}`);
    return null;
  }
}

async function classifySentences(): Promise<void> {
  console.log('PMQ Sentence Classifier (Ollama)');
  console.log('================================\n');

  // Check if input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    console.error('Run "npx ts-node scripts/extract-sentences.ts" first.');
    process.exit(1);
  }

  // Initialize Ollama client
  const ollama = new Ollama();

  // Test connection
  console.log(`Testing connection to Ollama (model: ${MODEL})...`);
  try {
    await ollama.chat({
      model: MODEL,
      messages: [{ role: 'user', content: 'Reply with just "ok"' }],
    });
    console.log('Connected successfully!\n');
  } catch (error) {
    console.error('Failed to connect to Ollama!');
    console.error('\nMake sure Ollama is running:');
    console.error('  1. Install: brew install ollama');
    console.error('  2. Start: ollama serve');
    console.error('  3. Pull model: ollama pull llama3.2');
    console.error(`\nError: ${error}`);
    process.exit(1);
  }

  // Load sentences
  const data: SentencesFile = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));

  // Prioritize frequent sentences, then add some singles
  let toClassify = [...data.frequent, ...data.single.slice(0, 200)];

  // Apply limit if specified
  if (LIMIT < toClassify.length) {
    console.log(`Limiting to ${LIMIT} sentences (--limit flag)`);
    toClassify = toClassify.slice(0, LIMIT);
  }

  console.log(`Classifying ${toClassify.length} sentences...`);
  console.log(`  - ${data.frequent.length} frequent (appear 2+ times)`);
  console.log(`  - ${Math.min(data.single.length, 200)} single-occurrence (sampled)\n`);

  const candidates: Candidate[] = [];
  let bingoWorthyCount = 0;

  // Process sentences one by one with live progress
  for (let i = 0; i < toClassify.length; i++) {
    const sentence = toClassify[i];
    const progress = `[${i + 1}/${toClassify.length}]`;

    // Truncate long sentences for display
    const displayText = sentence.text.length > 60
      ? sentence.text.substring(0, 57) + '...'
      : sentence.text;

    console.log(`${progress} Classifying: "${displayText}"`);

    const result = await classifySentence(ollama, sentence.text);

    if (result && result.bingoWorthy) {
      bingoWorthyCount++;
      console.log(`  ✓ BINGO-WORTHY (${result.category}, confidence: ${result.confidence.toFixed(2)})`);
      candidates.push({
        id: sentence.id,
        text: sentence.text,
        confidence: result.confidence,
        category: result.category,
        frequency: sentence.count,
        lastSeen: sentence.date,
        speaker: sentence.speaker,
        party: sentence.party,
        sources: sentence.sources.map((s) => ({
          date: s.date,
          speaker: s.speaker,
        })),
      });
    } else if (result) {
      console.log(`  ✗ not bingo-worthy`);
    } else {
      console.log(`  ⚠ classification failed`);
    }
  }

  console.log('\n\n--- Results ---');
  console.log(`Total classified: ${toClassify.length}`);
  console.log(`Bingo-worthy candidates: ${bingoWorthyCount}`);

  // Sort candidates by confidence (highest first)
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Output structure
  const output = {
    metadata: {
      classifiedAt: new Date().toISOString(),
      model: MODEL,
      totalClassified: toClassify.length,
      bingoWorthyCount: candidates.length,
    },
    candidates,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nWritten ${candidates.length} candidates to ${OUTPUT_FILE}`);
  console.log('\nNext steps:');
  console.log('  1. Open scripts/candidates.json');
  console.log('  2. Review candidates and set "approved": true on good ones');
  console.log('  3. Run "npx ts-node scripts/generate-phrase-bank.ts"');
}

classifySentences().catch(console.error);
