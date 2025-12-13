import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PMQSchedule, PMQSession } from '../models/schedule.model';

@Injectable({
  providedIn: 'root',
})
export class SchedulingService {
  private readonly http = inject(HttpClient);

  private schedule = signal<PMQSchedule | null>(null);

  /** All upcoming PMQ sessions */
  readonly sessions = computed(() => this.schedule()?.sessions ?? []);

  /** Last time the schedule data was updated */
  readonly lastUpdated = computed(() => this.schedule()?.lastUpdated ?? null);

  /** Next upcoming PMQ session */
  readonly nextSession = computed<PMQSession | null>(() => {
    const sessions = this.sessions();
    if (sessions.length === 0) return null;

    const todayStr = this.toUKDateString(new Date());

    // Find first session that's today or in the future
    for (const session of sessions) {
      if (session.date >= todayStr) {
        return session;
      }
    }

    return null;
  });

  /** Load schedule data from JSON file */
  async loadSchedule(): Promise<void> {
    try {
      const schedule = await firstValueFrom(
        this.http.get<PMQSchedule>('data/pmq-schedule.json')
      );
      this.schedule.set(schedule);
    } catch (error) {
      console.warn('Failed to load PMQ schedule:', error);
    }
  }

  /** Convert date to UK timezone date string (YYYY-MM-DD) */
  private toUKDateString(date: Date): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  }

  /** Format next session date for display */
  formatNextSessionDate(): string {
    const session = this.nextSession();
    if (!session) return 'No upcoming sessions';

    const date = new Date(session.date + 'T12:00:00');
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }
}
