/**
 * Classify sentences by matching to preset bingo labels or suggesting new ones
 *
 * Uses Google Gemini to match PMQ sentences to known bingo phrases
 * and track popularity of each label.
 *
 * Usage: npx tsx scripts/classify-with-labels.ts
 *        npx tsx scripts/classify-with-labels.ts --limit=10
 *
 * Prerequisites:
 *   - Get API key from https://aistudio.google.com/app/apikey
 *   - Set GEMINI_API_KEY in .env file
 */

import * as fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const INPUT_FILE = 'scripts/sentences.json';
const LABELS_FILE = 'scripts/preset-labels.json';
const OUTPUT_FILE = 'scripts/labelled-results.json';
const MODEL = 'gemini-2.0-flash';

// Parse --limit and --offset flags from command line
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

const offsetArg = process.argv.find((arg) => arg.startsWith('--offset='));
const OFFSET = offsetArg ? parseInt(offsetArg.split('=')[1], 10) : 0;

// Load API key from environment or .env file
function getApiKey(): string {
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }

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
      'Then create a .env file with: GEMINI_API_KEY=your_key_here'
  );
}

interface PresetLabel {
  id: string;
  text: string;
  category: string;
}

interface LabelsFile {
  labels: PresetLabel[];
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
  metadata: object;
  frequent: ExtractedSentence[];
  single: ExtractedSentence[];
}

interface ClassificationResult {
  bingoWorthy: boolean;
  matchedLabel: string | null;
  suggestedLabel: string | null;
  category: string | null;
  confidence: number;
}

interface LabelCount {
  labelId: string;
  text: string;
  category: string;
  count: number;
}

interface SuggestedLabel {
  text: string;
  category: string | null;
  count: number;
  examples: string[];
}

interface Match {
  sentenceId: string;
  sentence: string;
  matchedLabel: string | null;
  suggestedLabel: string | null;
  category: string | null;
  confidence: number;
  date: string;
  speaker?: string;
}

function buildPrompt(labels: PresetLabel[]): string {
  const labelList = labels.map((l) => `- ${l.id}: "${l.text}" (${l.category})`).join('\n');

  return `You are a cynical British political journalist analysing PMQs for a drinking game / bingo card.

You're looking for the REHEARSED CLICHÉS, DEFLECTIONS, and POLITICAL WAFFLE that politicians always trot out.

PRESET BINGO LABELS (match if sentence relates to these):
${labelList}

TASK: For this sentence:
1. Does it match an existing preset label? Return the label ID.
2. If not, is it classic political waffle worth mocking on a bingo card?
   - Suggest a SHORT, WITTY label (2-4 words) in the style of the presets above
   - Think: deflections, blame-shifting, empty boasts, hollow pledges, stock phrases

GOOD suggested labels:
- Use the ACTUAL PHRASE or close paraphrase from the sentence
- Someone watching live should hear the words and think "that's my bingo square!"
- 2-5 words max, taken directly from what was said

Examples:
- "inflation has nearly doubled" → "Inflation Has Doubled" ✓
- "500,000 more people are in work" → "More People in Work" ✓
- "we will continue to support" → "Continue to Support" ✓
- "the party opposite" → "The Party Opposite" ✓
- "I'll write to the member" → "I'll Write to You" ✓

BAD suggestions (too clever/interpreted):
- "Stats Don't Lie" ❌ (not what they said)
- "Jobs Miracle" ❌ (editorial, not the actual phrase)
- "World Stage Saviour" ❌ (too clever)
- "Hollow Platitudes" ❌ (your interpretation, not their words)

NOT bingo-worthy at all:
- Speaker procedural calls ("I call the member", "Order!")
- Specific constituency issues with named individuals
- Genuine detailed policy (specific numbers, dates)
- One-off statements that aren't recurring clichés

Sentence: "{sentence}"

Reply with ONLY valid JSON (no markdown):
{"bingoWorthy": true, "matchedLabel": "label-id-or-null", "suggestedLabel": "Short Witty Label or null", "category": "attack|deflection|boast|pledge|cliche|null", "confidence": 0.85}`;
}

async function classifySentence(
  model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  prompt: string,
  sentence: string
): Promise<ClassificationResult | null> {
  try {
    const fullPrompt = prompt.replace('{sentence}', sentence.replace(/"/g, '\\"'));

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const content = response.text().trim();

    // Clean up response
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(jsonStr);

    return {
      bingoWorthy: Boolean(parsed.bingoWorthy),
      matchedLabel: parsed.matchedLabel || null,
      suggestedLabel: parsed.suggestedLabel || null,
      category: parsed.category || null,
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  } catch (error) {
    console.error(`  Error: ${error}`);
    return null;
  }
}

async function classifyWithLabels(): Promise<void> {
  console.log('PMQ Label Matcher (Google Gemini)');
  console.log('=================================\n');

  // Check files exist
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    console.error('Run "npm run extract-sentences" first.');
    process.exit(1);
  }

  if (!fs.existsSync(LABELS_FILE)) {
    console.error(`Labels file not found: ${LABELS_FILE}`);
    process.exit(1);
  }

  // Load preset labels
  const labelsData: LabelsFile = JSON.parse(fs.readFileSync(LABELS_FILE, 'utf-8'));
  console.log(`Loaded ${labelsData.labels.length} preset labels\n`);

  // Initialize Gemini
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });

  console.log(`Using model: ${MODEL}`);
  console.log('Testing connection...');

  try {
    const testResult = await model.generateContent('Reply with just "ok"');
    console.log(`Connected! Response: "${testResult.response.text().trim()}"\n`);
  } catch (error) {
    console.error('Failed to connect to Gemini API!');
    console.error(`Error: ${error}`);
    process.exit(1);
  }

  // Load sentences
  const data: SentencesFile = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  let toClassify = [...data.frequent, ...data.single.slice(0, 500)];

  // Apply offset first, then limit
  if (OFFSET > 0) {
    console.log(`Skipping first ${OFFSET} sentences (--offset flag)`);
    toClassify = toClassify.slice(OFFSET);
  }

  if (LIMIT < toClassify.length) {
    console.log(`Limiting to ${LIMIT} sentences (--limit flag)`);
    toClassify = toClassify.slice(0, LIMIT);
  }

  console.log(`Classifying ${toClassify.length} sentences...\n`);

  // Build prompt once
  const prompt = buildPrompt(labelsData.labels);

  // Track results
  const labelCounts = new Map<string, number>();
  const suggestedLabels = new Map<string, { category: string | null; count: number; examples: string[] }>();
  const matches: Match[] = [];

  // Initialize label counts
  for (const label of labelsData.labels) {
    labelCounts.set(label.id, 0);
  }

  // Process sentences
  for (let i = 0; i < toClassify.length; i++) {
    const sentence = toClassify[i];
    const progress = `[${i + 1}/${toClassify.length}]`;

    const displayText =
      sentence.text.length > 55 ? sentence.text.substring(0, 52) + '...' : sentence.text;

    console.log(`${progress} "${displayText}"`);

    const result = await classifySentence(model, prompt, sentence.text);

    if (result) {
      if (result.matchedLabel && result.matchedLabel !== 'null' && labelCounts.has(result.matchedLabel)) {
        // Matched a preset label (verify it's a real label ID)
        const currentCount = labelCounts.get(result.matchedLabel) || 0;
        labelCounts.set(result.matchedLabel, currentCount + 1);
        console.log(`  → Matched: ${result.matchedLabel}`);

        matches.push({
          sentenceId: sentence.id,
          sentence: sentence.text,
          matchedLabel: result.matchedLabel,
          suggestedLabel: null,
          category: result.category,
          confidence: result.confidence,
          date: sentence.date,
          speaker: sentence.speaker,
        });
      } else if (result.bingoWorthy && result.suggestedLabel) {
        // New suggested label
        const normalized = result.suggestedLabel.toLowerCase();
        const existing = suggestedLabels.get(normalized);

        if (existing) {
          existing.count++;
          if (existing.examples.length < 3) {
            existing.examples.push(sentence.text.substring(0, 80));
          }
        } else {
          suggestedLabels.set(normalized, {
            category: result.category,
            count: 1,
            examples: [sentence.text.substring(0, 80)],
          });
        }
        console.log(`  → Suggested: "${result.suggestedLabel}"`);

        matches.push({
          sentenceId: sentence.id,
          sentence: sentence.text,
          matchedLabel: null,
          suggestedLabel: result.suggestedLabel,
          category: result.category,
          confidence: result.confidence,
          date: sentence.date,
          speaker: sentence.speaker,
        });
      } else {
        console.log(`  ✗ not bingo-worthy`);
      }
    } else {
      console.log(`  ⚠ classification failed`);
    }

    // Rate limit delay
    if (i < toClassify.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  // Build output
  const labelPopularity: LabelCount[] = labelsData.labels
    .map((label) => ({
      labelId: label.id,
      text: label.text,
      category: label.category,
      count: labelCounts.get(label.id) || 0,
    }))
    .filter((l) => l.count > 0)
    .sort((a, b) => b.count - a.count);

  const suggestedNewLabels: SuggestedLabel[] = Array.from(suggestedLabels.entries())
    .map(([text, data]) => ({
      text: text.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      category: data.category,
      count: data.count,
      examples: data.examples,
    }))
    .sort((a, b) => b.count - a.count);

  const matchedCount = matches.filter((m) => m.matchedLabel).length;
  const suggestedCount = matches.filter((m) => m.suggestedLabel).length;

  const output = {
    metadata: {
      classifiedAt: new Date().toISOString(),
      model: MODEL,
      totalSentences: toClassify.length,
      matchedToPreset: matchedCount,
      newSuggestions: suggestedCount,
      notBingoWorthy: toClassify.length - matchedCount - suggestedCount,
    },
    labelPopularity,
    suggestedNewLabels,
    matches,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  // Print summary
  console.log('\n\n========== RESULTS ==========\n');
  console.log(`Total classified: ${toClassify.length}`);
  console.log(`Matched to preset labels: ${matchedCount}`);
  console.log(`New suggestions: ${suggestedCount}`);
  console.log(`Not bingo-worthy: ${toClassify.length - matchedCount - suggestedCount}`);

  console.log('\n--- LABEL POPULARITY (Top 10) ---');
  for (const label of labelPopularity.slice(0, 10)) {
    console.log(`  ${label.count.toString().padStart(3)}x  ${label.text}`);
  }

  console.log('\n--- SUGGESTED NEW LABELS (Top 10) ---');
  for (const label of suggestedNewLabels.slice(0, 10)) {
    console.log(`  ${label.count.toString().padStart(3)}x  ${label.text} (${label.category})`);
  }

  console.log(`\nWritten full results to ${OUTPUT_FILE}`);
}

classifyWithLabels().catch(console.error);
