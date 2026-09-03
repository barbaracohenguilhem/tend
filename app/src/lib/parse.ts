import { people } from './people';
import type { Mode, OwnerId, Priority } from './types';

export interface ParsedDraft {
  title: string;
  /** Day offset from today; undefined when nothing was typed */
  due: number | undefined;
  time: string | null;
  owner: OwnerId | null;
  priority: Priority | null;
}

/**
 * Natural-language quick-add: "Send GA files to Unzile tomorrow 9am @Fernanda high".
 * Dates, @people / "for <name>", times and "high"/"low" are lifted out of the text.
 */
export function parseDraft(raw: string, mode: Mode, base: Date): ParsedDraft {
  let text = ' ' + raw + ' ';
  const out: Omit<ParsedDraft, 'title'> = { due: undefined, time: null, owner: null, priority: null };
  const eat = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = text.match(re);
    if (m) { fn(m); text = text.replace(m[0], ' '); }
  };
  // "@fernanda" or "for Fernanda" — but not "for Fernanda's feedback" (that is her feedback, not her task)
  people.forEach(p => p.keys.forEach(k => eat(new RegExp('\\s(?:@|for\\s)' + k + "(?![\\w'’-])", 'i'), () => { out.owner = p.id; })));
  eat(/\s@me(?![\w'’-])/i, () => { out.owner = mode === 'carla' ? 'carla' : 'none'; });
  // priority words must stand alone: "high-res renders" keeps its title
  eat(/\s(high|urgent)(?![\w'’-])/i, () => { out.priority = 'High'; });
  eat(/\s(low)(?![\w'’-])/i, () => { out.priority = 'Low'; });
  eat(/\s(?:at\s)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i, m => {
    let h = (+m[1]) % 12;
    if (m[3].toLowerCase() === 'pm') h += 12;
    out.time = `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
  });
  if (!out.time) eat(/\s(?:at\s)?([01]?\d|2[0-3]):([0-5]\d)\b/, m => { out.time = `${String(+m[1]).padStart(2, '0')}:${m[2]}`; });
  eat(/\s(today|tonight)\b/i, () => { out.due = 0; });
  eat(/\s(tomorrow|tmrw|tmr)\b/i, () => { out.due = 1; });
  eat(/\snext\sweek\b/i, () => { out.due = 7; });
  eat(/\sin\s(\d+)\sdays?\b/i, m => { out.due = +m[1]; });
  // Full day names anywhere; three-letter forms only after on/by/next or at the very end ("sun exposure" is not a date)
  eat(/\s(?:(?:on|by)\s)?(next\s)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|(?<=\s(?:on|by|next)\s)(?:mon|tue|wed|thu|fri|sat|sun)|(?:mon|tue|wed|thu|fri|sat|sun)(?=\s*$))(?![\w'’-])/i, m => {
    const idx = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(m[2].slice(0, 3).toLowerCase());
    let diff = (idx - base.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    if (m[1]) diff += 7;
    out.due = diff;
  });
  let title = text.replace(/\s+/g, ' ').trim().replace(/[\s,]+(at|on|by|for)$/i, '').replace(/^(at|on|by|for)\s+/i, '');
  if (title) title = title[0].toUpperCase() + title.slice(1);
  return { ...out, title };
}
