import { Component, inject, OnInit } from '@angular/core';
import { SchedulingService } from '../../services/scheduling.service';

@Component({
  selector: 'app-pmq-countdown',
  templateUrl: './pmq-countdown.html',
  styleUrl: './pmq-countdown.scss',
})
export class PmqCountdown implements OnInit {
  private readonly schedulingService = inject(SchedulingService);

  readonly nextSession = this.schedulingService.nextSession;

  ngOnInit(): void {
    this.schedulingService.loadSchedule();
  }

  get formattedDate(): string {
    return this.schedulingService.formatNextSessionDate();
  }
}
