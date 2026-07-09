# PMQ Central — Product Spec

**Date:** 2026-04-09  
**Status:** Draft  
**Author:** Marvin Barretto

---

## Vision

PMQ Central is a parliamentary stats and bingo platform built as a public automation experiment. The bingo game is the weekly heartbeat — something to play live every Wednesday at 12:00. The archive and scoring system is the always-on layer that makes the site worth visiting on any day.

The meta-goal is to see how much of the pipeline can be fully automated — from detecting a new session, extracting the transcript, scoring the exchanges, generating bingo card predictions, and publishing session data — with zero human intervention. The build process is documented publicly as a portfolio piece.

---

## Stack

| Concern | Choice |
|---|---|
| Frontend / SSR | Next.js 15 (App Router) |
| Database / Auth | Supabase (Postgres + RLS + OAuth) |
| LLM | OpenRouter (model-agnostic) |
| Deployment | Vercel |
| Blog content | MDX at `/blog` |
| Styling | SCSS / CSS Modules (no Tailwind) |
| Testing | Vitest (unit) + Playwright (E2E) |

---

## Core Features

### 1. Bingo Game

The existing game rebuilt in Next.js. A 5×5 card of phrases generated from AI predictions for that week's PMQ session. Cells are marked manually during the live session. Win detection: row, column, diagonal, full house.

- Anonymous play via localStorage (no account needed)
- Signed-in users get their card persisted and counted in season stats
- Card phrases are weighted by LLM prediction confidence for that week's news cycle
- New card generated each session; previous session cards browsable in archive

### 2. Archive — Parliamentary League Table

The "football table" for PMQs. Tracks the PM and Leader of the Opposition across the parliamentary season.

```
Player          P   W   D   L   Pts   Form       Top Phrase
Keir Starmer   34  22   4   8    70   W W L W D  "Cost of Living" ×47
Kemi Badenoch  34   8   4  22    28   L L W L D  "Economic Growth" ×31
```

- Win/draw/loss determined by community vote (see Voting)
- Season resets each parliamentary year
- Per-politician profile page with full history

### 3. Session Scoring — Boxing Format

Each PMQ session is structured as a boxing match. The PM and Opposition Leader each get 6 questions (rounds). Other party leaders appear as bonus rounds.

Per-round community ratings:
- **Landed** — the point connected
- **Fluffed** — missed opportunity
- **Devastating** — clean hit, crowd reacted
- **Funny** — got a laugh

Aggregate to a scorecard at session level. LLM generates a short narrative summary from the transcript ("Starmer landed three clean jabs in rounds 2–4, but Badenoch's round 5 attack on mortgage rates went unanswered").

**Experimental pipeline feature:** attempt to detect crowd reaction from YouTube audio — volume spikes, frequency of "Order!" from the Speaker — as a corroborating signal. Flagged clearly as experimental in the UI and documented in the build diary.

### 4. Voting

- **Session-level**: Who won? PM / Opposition / Draw
- **Round-level**: Per-exchange ratings (see above)
- Anonymous voting via device fingerprint, one vote per session per device
- Signed-in users get vote history
- Voting closes 7 days after the session
- Results shown live with running percentages

### 5. Phrase Tracking

- Per-session phrase log: which bingo phrases were said, how many times
- All-time frequency table across sessions
- Phrase categories: attack, pledge, deflection, cliché, quip
- Source labelled on every phrase: `LLM extracted`, `community reported`, `manually curated`
- Confidence score shown where LLM was the source

### 6. Auth

Light touch. Supabase Auth with Google OAuth. No email/password.

Signed-in users get:
- Season bingo record (sessions played, bingos called, phrases spotted)
- Vote history
- Appear on community leaderboard

No account required to play bingo or vote (device-based fallback for both).

### 7. Blog — `/blog`

MDX files in the Next.js repo. Two content types:

- **Session recaps** — published after each PMQ, auto-drafted by LLM, manually reviewed before publish
- **Build diary** — how the automation works, what was hard, what surprised us

The build diary's engineering-focused entries are also cross-posted to the personal portfolio at `marvinbarretto.workers.dev`.

### 8. Automation Transparency

Every piece of data carries a provenance badge in the UI. Users can see what was automated vs human-confirmed. This is a feature, not a footnote — it's part of the meta-story.

| Data | Source |
|---|---|
| Session schedule | Automated — Parliament API |
| Transcript | Automated — YouTube + LLM extraction |
| Phrases detected | Automated — LLM, confidence scored |
| Bingo predictions | Automated — LLM + news scanning |
| Session summary | Automated — LLM draft, human reviewed |
| Who won | Community vote |
| Round ratings | Community vote |
| Audio signals | Experimental — YouTube audio analysis |

---

## Data Model

### `sessions`
```
id, date, youtube_url, hansard_url, status (scheduled|processing|live|complete),
pm_name, opposition_leader_name, pipeline_log (jsonb)
```

### `phrases`
```
id, text, category (attack|pledge|deflection|cliche|quip),
source (curated|llm|community), created_at
```

### `session_phrases`
```
session_id, phrase_id, count, confidence (0–1), source, created_at
```

### `votes`
```
id, session_id, choice (pm|opposition|draw),
user_id (nullable), fingerprint, created_at
```

### `round_ratings`
```
id, session_id, round_number (1–6), speaker (pm|opposition|other),
rating (landed|fluffed|devastating|funny),
user_id (nullable), fingerprint, created_at
```

### `politicians`
```
id, name, role (pm|opposition_leader|other), party, active_from, active_to
```

### `season_records`
```
politician_id, season (e.g. "2024-26"), p, w, d, l, pts, top_phrase_id
```

### `bingo_cards`
```
id, session_id, user_id (nullable), fingerprint,
phrase_ids (int[]), marked_positions (int[]), has_won, win_type, created_at
```

### `user_stats`
```
user_id, sessions_played, bingos_called, phrases_spotted, created_at
```

---

## Automation Pipeline

The core experiment. Target: zero human input from session detection to published data.

```
1. Schedule detection     Parliament API → sessions table (GitHub Actions cron)
2. YouTube discovery      Search Parliament YouTube channel → attach URL to session
3. Transcript extraction  YouTube captions or Whisper → raw text
4. Phrase detection       OpenRouter LLM → session_phrases with confidence scores
5. Round segmentation     LLM → identify 6 exchanges per leader from transcript
6. Bingo predictions      OpenRouter LLM + news headlines → weighted phrase list
7. Session summary        LLM → draft recap for /blog
8. Audio signals          YouTube audio → volume/Order! analysis (experimental)
```

Each pipeline step writes its status to `sessions.pipeline_log`. Failures are surfaced on the site ("Transcript not yet available — check back after 14:00").

---

## What Stays Manual (For Now)

- Blog post final edit and publish
- Manual phrase curation (overriding LLM extractions)
- Round rating quality review
- Any session where YouTube captions are unavailable

---

## Phasing

**Phase 1 — Foundation**
Rebuild bingo in Next.js, Supabase schema, basic session pages, community voting (who won), manual phrase entry. Site is live and playable.

**Phase 2 — Archive**
League table, politician profiles, phrase frequency charts, season records. The stats layer.

**Phase 3 — Automation**
YouTube transcript pipeline, LLM phrase detection, automated session creation, bingo prediction engine. The experiment begins.

**Phase 4 — Scoring**
Round-by-round ratings, boxing scorecard UI, LLM session summaries, audio signal experiments.

**Phase 5 — Blog & Meta**
MDX blog, session recaps, build diary, provenance UI, cross-post to portfolio.

---

## Open Questions

- Domain name (PMQ Central is a placeholder)
- Scoring points system — 3pts/W 1pt/D or something else?
- Whether LLM-drafted blog posts are published directly or always reviewed first
- Audio analysis feasibility — worth a spike in Phase 3
