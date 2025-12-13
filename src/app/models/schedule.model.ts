export interface PMQSession {
  date: string; // ISO date YYYY-MM-DD
  dayOfWeek: string;
}

export interface PMQSchedule {
  lastUpdated: string;
  sessions: PMQSession[];
}
