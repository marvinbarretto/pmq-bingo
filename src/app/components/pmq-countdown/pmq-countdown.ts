import { Component, inject, OnInit, computed } from '@angular/core';
import { SchedulingService } from '../../services/scheduling.service';

@Component({
  selector: 'app-pmq-countdown',
  templateUrl: './pmq-countdown.html',
  styleUrl: './pmq-countdown.scss',
})
export class PmqCountdown implements OnInit {
  private readonly schedulingService = inject(SchedulingService);

  readonly nextSession = this.schedulingService.nextSession;

  /** Days remaining until next PMQ (0 = today, null = no session / recess) */
  readonly daysUntil = computed<number | null>(() => {
    const session = this.nextSession();
    if (!session) return null;

    // Use midnight UTC of today's date in UK timezone for consistent day maths
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
    const today = new Date(todayStr + 'T00:00:00');
    const sessionDate = new Date(session.date + 'T00:00:00');

    const diffMs = sessionDate.getTime() - today.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  });

  ngOnInit(): void {
    this.schedulingService.loadSchedule();
  }

  get formattedDate(): string {
    return this.schedulingService.formatNextSessionDate();
  }
}
