/**
 * Fetch PMQ schedule from UK Parliament API
 *
 * Fetches sitting days from the Parliament Egg-Timer API,
 * filters for Wednesdays (PMQs day), and outputs JSON schedule.
 *
 * PMQs happens every Wednesday at 12:00 noon when Parliament is sitting.
 *
 * Usage: npx tsx scripts/fetch-pmq-schedule.ts
 *
 * Data source: https://api.parliament.uk/egg-timer/calendar/{year}/{month}.csv
 */

import * as fs from 'fs';

const OUTPUT_FILE = 'public/data/pmq-schedule.json';
const API_BASE = 'https://api.parliament.uk/egg-timer/calendar';

interface PMQSession {
  date: string; // ISO date YYYY-MM-DD
  dayOfWeek: string;
}

interface PMQSchedule {
  lastUpdated: string;
  sessions: PMQSession[];
}

interface CalendarDay {
  date: string;
  dayOfWeek: string;
  commonsType: string;
  isScrutinyDay: boolean;
}

/**
 * Parse CSV data from Parliament API
 * Format: Date,Day,Commons day type,Commons scrutiny day?,Lords day type,Lords scrutiny day?,Day URL
 * Date is just the day number (1, 2, 3...), year/month come from the URL
 */
function parseCSV(csvText: string, year: number, month: number): CalendarDay[] {
  const lines = csvText.trim().split('\n');

  // Skip header row
  const dataLines = lines.slice(1);

  return dataLines
    .map((line) => {
      // Handle CSV properly (fields may contain commas in quotes)
      const fields = line.split(',').map((f) => f.trim().replace(/^"|"$/g, ''));

      const [dayNum, dayOfWeek, commonsType, commonsScrutiny] = fields;

      // Construct full date from year, month, and day number
      const day = parseInt(dayNum, 10);
      if (isNaN(day)) return null;

      const monthStr = month.toString().padStart(2, '0');
      const dayStr = day.toString().padStart(2, '0');
      const date = `${year}-${monthStr}-${dayStr}`;

      return {
        date,
        dayOfWeek,
        commonsType: commonsType || '',
        isScrutinyDay: commonsScrutiny === 'True',
      };
    })
    .filter((day): day is CalendarDay => day !== null && day.dayOfWeek !== undefined);
}

/**
 * Fetch CSV data for a specific month
 */
async function fetchMonthData(year: number, month: number): Promise<CalendarDay[]> {
  const monthStr = month.toString().padStart(2, '0');
  const url = `${API_BASE}/${year}/${monthStr}.csv`;

  console.log(`  Fetching ${url}...`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`    Warning: HTTP ${response.status} for ${year}/${monthStr}`);
      return [];
    }

    const csvText = await response.text();
    return parseCSV(csvText, year, month);
  } catch (error) {
    console.warn(`    Error fetching ${year}/${monthStr}: ${error}`);
    return [];
  }
}

/**
 * Get months to fetch (current + next 3 months)
 */
function getMonthsToFetch(): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  const now = new Date();

  for (let i = 0; i < 4; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1, // 1-indexed
    });
  }

  return months;
}

/**
 * Filter for PMQ sessions (Wednesday sitting days)
 */
function filterPMQSessions(days: CalendarDay[]): PMQSession[] {
  return days
    .filter((day) => {
      // Must be a Wednesday
      if (day.dayOfWeek !== 'Wednesday') return false;

      // Must be a sitting day for Commons
      if (day.commonsType !== 'Parliamentary sitting day') return false;

      return true;
    })
    .map((day) => ({
      date: day.date,
      dayOfWeek: day.dayOfWeek,
    }));
}

async function fetchPMQSchedule(): Promise<void> {
  console.log('PMQ Schedule Fetcher');
  console.log('====================\n');

  const monthsToFetch = getMonthsToFetch();
  console.log(
    `Fetching ${monthsToFetch.length} months: ${monthsToFetch.map((m) => `${m.year}/${m.month}`).join(', ')}\n`
  );

  // Fetch all months
  const allDays: CalendarDay[] = [];

  for (const { year, month } of monthsToFetch) {
    const days = await fetchMonthData(year, month);
    allDays.push(...days);
  }

  console.log(`\nTotal days fetched: ${allDays.length}`);

  // Filter for PMQ sessions
  const pmqSessions = filterPMQSessions(allDays);
  console.log(`PMQ sessions found: ${pmqSessions.length}`);

  // Sort sessions by date
  const sortedSessions = pmqSessions.sort((a, b) => a.date.localeCompare(b.date));

  // Filter to only future sessions
  const today = new Date().toISOString().split('T')[0];
  const futureSessions = sortedSessions.filter((s) => s.date >= today);

  console.log(`Future PMQ sessions: ${futureSessions.length}`);

  // Build output
  const schedule: PMQSchedule = {
    lastUpdated: new Date().toISOString(),
    sessions: futureSessions,
  };

  // Ensure output directory exists
  const outputDir = OUTPUT_FILE.split('/').slice(0, -1).join('/');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(schedule, null, 2));
  console.log(`\nWritten to ${OUTPUT_FILE}`);

  // Show upcoming sessions
  if (futureSessions.length > 0) {
    console.log('\n--- Upcoming PMQ Sessions ---');
    for (const session of futureSessions.slice(0, 8)) {
      const date = new Date(session.date);
      const formatted = date.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      console.log(`  ${formatted}`);
    }
    if (futureSessions.length > 8) {
      console.log(`  ... and ${futureSessions.length - 8} more`);
    }
  } else {
    console.log('\nNo upcoming PMQ sessions found (Parliament may be in recess)');
  }
}

fetchPMQSchedule().catch(console.error);
