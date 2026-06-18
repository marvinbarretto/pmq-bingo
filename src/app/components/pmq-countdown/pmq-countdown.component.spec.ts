import '@angular/compiler'; // required for JIT compilation in Vitest environment
import { signal, computed } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PMQSession } from '../../models/schedule.model';

// ---------------------------------------------------------------------------
// Isolated helper — mirrors the daysUntil logic in the component so we can
// test the maths without spinning up Angular TestBed.
// ---------------------------------------------------------------------------

function computeDaysUntil(
  session: PMQSession | null,
  nowOverride?: Date
): number | null {
  if (!session) return null;

  const now = nowOverride ?? new Date();
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  const today = new Date(todayStr + 'T00:00:00');
  const sessionDate = new Date(session.date + 'T00:00:00');

  const diffMs = sessionDate.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PmqCountdown — daysUntil maths', () => {

  describe('normal case (N days in the future)', () => {
    it('returns 1 when the session is tomorrow', () => {
      const fakeNow = new Date('2025-09-10T09:00:00');
      const session: PMQSession = { date: '2025-09-11', dayOfWeek: 'Wednesday' };
      expect(computeDaysUntil(session, fakeNow)).toBe(1);
    });

    it('returns 7 when the session is one week away', () => {
      const fakeNow = new Date('2025-09-03T09:00:00');
      const session: PMQSession = { date: '2025-09-10', dayOfWeek: 'Wednesday' };
      expect(computeDaysUntil(session, fakeNow)).toBe(7);
    });

    it('returns the correct count regardless of the time of day', () => {
      // Even if it is 23:59 the day before, the day count should be 1
      const fakeNow = new Date('2025-09-10T23:59:59');
      const session: PMQSession = { date: '2025-09-11', dayOfWeek: 'Wednesday' };
      expect(computeDaysUntil(session, fakeNow)).toBe(1);
    });
  });

  describe('0-day case (today)', () => {
    it('returns 0 when the session date matches today', () => {
      const fakeNow = new Date('2025-09-10T09:00:00');
      const session: PMQSession = { date: '2025-09-10', dayOfWeek: 'Wednesday' };
      expect(computeDaysUntil(session, fakeNow)).toBe(0);
    });

    it('returns 0 even when checked early in the morning on PMQ day', () => {
      const fakeNow = new Date('2025-09-10T00:01:00');
      const session: PMQSession = { date: '2025-09-10', dayOfWeek: 'Wednesday' };
      expect(computeDaysUntil(session, fakeNow)).toBe(0);
    });

    it('returns 0 even when checked just before midnight on PMQ day', () => {
      const fakeNow = new Date('2025-09-10T23:58:00');
      const session: PMQSession = { date: '2025-09-10', dayOfWeek: 'Wednesday' };
      expect(computeDaysUntil(session, fakeNow)).toBe(0);
    });
  });

  describe('recess case (no session)', () => {
    it('returns null when session is null', () => {
      expect(computeDaysUntil(null)).toBeNull();
    });

    it('returns null regardless of the current date', () => {
      const fakeNow = new Date('2025-08-15T12:00:00');
      expect(computeDaysUntil(null, fakeNow)).toBeNull();
    });
  });
});
