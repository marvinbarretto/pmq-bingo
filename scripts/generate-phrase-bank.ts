/**
 * Generate final phrase-bank.json from labelled results
 *
 * Reads labelled-results.json and preset-labels.json,
 * combines preset labels with top suggested new labels,
 * and outputs to public/data/phrase-bank.json
 *
 * Usage: npx tsx scripts/generate-phrase-bank.ts
 *        npx tsx scripts/generate-phrase-bank.ts --top=10  (include top 10 suggested labels)
 */

import * as fs from 'fs';

const LABELS_FILE = 'scripts/preset-labels.json';
const RESULTS_FILE = 'scripts/labelled-results.json';
const REJECTED_FILE = 'scripts/rejected-labels.json';
const OUTPUT_FILE = 'public/data/phrase-bank.json';

// Parse --top flag (how many suggested labels to include)
const topArg = process.argv.find((arg) => arg.startsWith('--top='));
const TOP_SUGGESTED = topArg ? parseInt(topArg.split('=')[1], 10) : 15;

interface PresetLabel {
  id: string;
  text: string;
  category: string;
}

interface LabelsFile {
  labels: PresetLabel[];
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

interface LabelledResults {
  metadata: {
    classifiedAt: string;
    totalSentences: number;
    matchedToPreset: number;
    newSuggestions: number;
  };
  labelPopularity: LabelCount[];
  suggestedNewLabels: SuggestedLabel[];
}

interface PhraseEntry {
  id: string;
  text: string;
  frequency?: number;
  category?: string;
}

interface RejectedFile {
  description: string;
  rejected: string[];
}

function normalizeForDedup(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

function loadRejectedLabels(): Set<string> {
  if (!fs.existsSync(REJECTED_FILE)) {
    return new Set();
  }
  const data: RejectedFile = JSON.parse(fs.readFileSync(REJECTED_FILE, 'utf-8'));
  return new Set(data.rejected.map((r) => normalizeForDedup(r)));
}

async function generatePhraseBank(): Promise<void> {
  console.log('PMQ Phrase Bank Generator');
  console.log('=========================\n');

  const phrases: PhraseEntry[] = [];
  const seenNormalized = new Set<string>();
  const rejectedLabels = loadRejectedLabels();

  if (rejectedLabels.size > 0) {
    console.log(`Loaded ${rejectedLabels.size} rejected labels to filter out\n`);
  }

  // 1. Load preset labels (always included)
  console.log('Loading preset labels...');
  if (!fs.existsSync(LABELS_FILE)) {
    console.error(`Labels file not found: ${LABELS_FILE}`);
    process.exit(1);
  }

  const labelsData: LabelsFile = JSON.parse(fs.readFileSync(LABELS_FILE, 'utf-8'));
  console.log(`  Found ${labelsData.labels.length} preset labels`);

  // 2. Load labelled results for popularity data
  let labelPopularity: LabelCount[] = [];
  let suggestedLabels: SuggestedLabel[] = [];

  if (fs.existsSync(RESULTS_FILE)) {
    console.log('Loading labelled results for popularity data...');
    const resultsData: LabelledResults = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf-8'));
    labelPopularity = resultsData.labelPopularity || [];
    suggestedLabels = resultsData.suggestedNewLabels || [];
    console.log(`  ${labelPopularity.length} labels have popularity data`);
    console.log(`  ${suggestedLabels.length} suggested new labels available`);
  } else {
    console.log(`  No results file found at ${RESULTS_FILE}`);
    console.log('  Run "npm run classify-labels" first for popularity data.\n');
  }

  // 3. Add preset labels with their popularity
  console.log('\nAdding preset labels...');
  for (const label of labelsData.labels) {
    const normalized = normalizeForDedup(label.text);
    if (!seenNormalized.has(normalized)) {
      seenNormalized.add(normalized);
      const popularity = labelPopularity.find((p) => p.labelId === label.id);
      phrases.push({
        id: label.id,
        text: label.text,
        frequency: popularity?.count || 0,
        category: label.category,
      });
    }
  }
  console.log(`  Added ${phrases.length} preset labels`);

  // 4. Add top suggested labels
  if (suggestedLabels.length > 0) {
    console.log(`\nAdding top ${TOP_SUGGESTED} suggested labels...`);
    let addedCount = 0;

    for (const suggested of suggestedLabels.slice(0, TOP_SUGGESTED * 2)) {
      // Stop once we've added enough
      if (addedCount >= TOP_SUGGESTED) break;

      const normalized = normalizeForDedup(suggested.text);

      // Skip if rejected
      if (rejectedLabels.has(normalized)) {
        console.log(`    Skipping rejected: "${suggested.text}"`);
        continue;
      }

      // Skip if already seen
      if (seenNormalized.has(normalized)) {
        continue;
      }

      seenNormalized.add(normalized);
      phrases.push({
        id: `suggested-${addedCount + 1}`,
        text: suggested.text,
        frequency: suggested.count,
        category: suggested.category || 'cliche',
      });
      addedCount++;
    }
    console.log(`  Added ${addedCount} suggested labels`);
  }

  // 5. Sort by frequency (most popular first), then alphabetically
  phrases.sort((a, b) => {
    if ((b.frequency || 0) !== (a.frequency || 0)) {
      return (b.frequency || 0) - (a.frequency || 0);
    }
    return a.text.localeCompare(b.text);
  });

  // 6. Re-index phrases
  const finalPhrases = phrases.map((p, i) => ({
    ...p,
    id: `p${i + 1}`,
  }));

  // 7. Validate
  console.log(`\nTotal phrases: ${finalPhrases.length}`);

  if (finalPhrases.length < 25) {
    console.warn(`\nWARNING: Only ${finalPhrases.length} phrases - need at least 25 for a 5x5 bingo board!`);
    console.warn('Add more preset labels or run classification to get suggestions.');
  }

  // 8. Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalPhrases, null, 2));
  console.log(`\nWritten ${finalPhrases.length} phrases to ${OUTPUT_FILE}`);

  // 9. Show summary
  console.log('\n--- Top 15 by Popularity ---');
  for (const phrase of finalPhrases.slice(0, 15)) {
    const freq = phrase.frequency ? `${phrase.frequency}x` : '0x';
    console.log(`  ${freq.padStart(4)}  ${phrase.text} (${phrase.category})`);
  }

  if (finalPhrases.length > 15) {
    console.log(`  ... and ${finalPhrases.length - 15} more`);
  }
}

generatePhraseBank().catch(console.error);
