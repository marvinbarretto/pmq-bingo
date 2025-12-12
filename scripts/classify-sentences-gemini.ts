/**
 * Classify extracted sentences using Google Gemini (free tier)
 *
 * Reads sentences.json and classifies each sentence as "bingo-worthy" or not
 * using Gemini Flash.
 *
 * Usage: npx tsx scripts/classify-sentences-gemini.ts
 *        npx tsx scripts/classify-sentences-gemini.ts --limit=10
 *
 * Prerequisites:
 *   - Get API key from https://aistudio.google.com/app/apikey
 *   - Set GEMINI_API_KEY environment variable or create .env file
 */

import * as fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const INPUT_FILE = 'scripts/sentences.json';
const OUTPUT_FILE = 'scripts/candidates.json';
const MODEL = 'gemini-2.0-flash';

// Parse --limit flag from command line
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

// Load API key from environment or .env file
function getApiKey(): string {
  // Check environment variable first
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

  // Try loading from .env file
  const envPath = '.env';
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const match = envContent.match(/GEMINI_API_KEY=(.+)/);
    if (match) {
      return match[1].trim();
    }
  }

  throw new Error(
    'GEMINI_API_KEY not found!\n\n' +
      'Get your free API key from: https://aistudio.google.com/app/apikey\n\n' +
      'Then either:\n' +
      '  1. Create a .env file with: GEMINI_API_KEY=your_key_here\n' +
      '  2. Or run with: GEMINI_API_KEY=your_key npm run classify-gemini'
  );
}

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
- "Broken Britain"
- "The mess we inherited"

BAD examples (NOT bingo-worthy):
- Procedural statements ("I refer to my previous answer", "This morning I had meetings")
- Specific policy details with numbers/dates
- Constituency-specific mentions
- Simple acknowledgments ("I am grateful", "I pay tribute")
- Generic parliamentary language ("I call the Leader of the Opposition")
- Incomplete sentence fragments

Categories:
- attack: Criticism of opponents
- deflection: Avoiding the question
- boast: Self-congratulation about achievements
- pledge: Promise to do something
- cliche: Overused phrase or soundbite

Sentence: "{sentence}"

Reply with ONLY valid JSON (no markdown, no explanation):
{"bingoWorthy": true, "confidence": 0.85, "category": "attack"}`;

async function classifySentence(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  sentence: string
): Promise<ClassificationResult | null> {
  try {
    const prompt = CLASSIFICATION_PROMPT.replace('{sentence}', sentence.replace(/"/g, '\\"'));

    const result = await model.generateContent(prompt);
    const response = result.response;
    const content = response.text().trim();

    // Clean up response - remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(jsonStr);

    return {
      bingoWorthy: Boolean(parsed.bingoWorthy),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      category: parsed.category || null,
    };
  } catch (error) {
    console.error(`  Error classifying: ${error}`);
    return null;
  }
}

async function classifySentences(): Promise<void> {
  console.log('PMQ Sentence Classifier (Google Gemini)');
  console.log('=======================================\n');

  // Check if input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    console.error('Run "npm run extract-sentences" first.');
    process.exit(1);
  }

  // Initialize Gemini
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });

  console.log(`Using model: ${MODEL}`);

  // Test connection
  console.log('Testing connection...');
  try {
    const testResult = await model.generateContent('Reply with just "ok"');
    const testResponse = testResult.response.text().trim();
    console.log(`Connected! Test response: "${testResponse}"\n`);
  } catch (error) {
    console.error('Failed to connect to Gemini API!');
    console.error(`Error: ${error}`);
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
  console.log(`  - ${Math.min(data.frequent.length, toClassify.length)} frequent (appear 2+ times)`);
  console.log(
    `  - ${Math.max(0, toClassify.length - data.frequent.length)} single-occurrence (sampled)\n`
  );

  const candidates: Candidate[] = [];
  let bingoWorthyCount = 0;

  // Process sentences one by one with live progress
  for (let i = 0; i < toClassify.length; i++) {
    const sentence = toClassify[i];
    const progress = `[${i + 1}/${toClassify.length}]`;

    // Truncate long sentences for display
    const displayText =
      sentence.text.length > 60 ? sentence.text.substring(0, 57) + '...' : sentence.text;

    console.log(`${progress} "${displayText}"`);

    const result = await classifySentence(model, sentence.text);

    if (result && result.bingoWorthy) {
      bingoWorthyCount++;
      console.log(
        `  ✓ BINGO-WORTHY (${result.category}, confidence: ${result.confidence.toFixed(2)})`
      );
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

    // Small delay to respect rate limits (free tier: 15 requests/minute)
    if (i < toClassify.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
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
  console.log('  3. Run "npm run generate-phrase-bank"');
}

classifySentences().catch(console.error);
