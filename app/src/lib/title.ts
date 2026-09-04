/**
 * Short titles for cards and lists.
 *
 * LOLI writes each task's "Next action" as a full sentence (often 80–200 characters: two verbs, a parenthesis, a
 * deadline). The Notion "Title" property carries a hand-written short title; when it is empty — a task LOLI has just
 * filed — the app shortens the sentence itself so the list stays scannable. The full sentence is still shown on the
 * task's own screen.
 */

/** Longest title we let onto a card before cutting at a word boundary. */
const MAX = 64;

/** LOLI boilerplate that says nothing about the task: the e-mail subject is the better title then. */
const GENERIC = [
  /^revisar (o|a) (e-?mail|solicita[çc][ãa]o|cobran[çc]a|mensagem)\b/i,
  /^revisar os detalhes\b/i,
  /^review the (e-?mail|request|message)\b/i,
];

/** A Portuguese verb in the infinitive follows (enviar, responder, garantir…). */
const VERB_PT = '(?=[a-záéíóúãõâêôç]{2,}(?:ar|er|ir)\\b)';
/** The English verbs LOLI chains after "and" / "then". */
const VERB_EN = '(?=(?:request|send|ask|confirm|reply|review|approve|forward|share|schedule|add|update|check|follow|call|book|pay|sign|upload|download|prepare|provide|return)\\b)';

/** Places where a long sentence can be cut without losing its point: a second verb, a purpose clause, a deadline, a caveat. */
const CUTS: RegExp[] = [
  /;\s/,
  /\s[—–]\s/,
  new RegExp(`,?\\s(?:e|and)\\s(?:então\\s|depois\\s|em seguida\\s|then\\s)?${VERB_PT}`, 'i'),
  new RegExp(`,?\\s(?:and)\\s(?:then\\s)?${VERB_EN}`, 'i'),
  new RegExp(`,\\s(?:então\\s|depois\\s|em seguida\\s|then\\s)?${VERB_PT}`, 'i'),
  new RegExp(`,\\s(?:then\\s)?${VERB_EN}`, 'i'),
  /\s(?:e|and)\s(?:então|depois|em seguida|then)\b/i,
  /\se\/ou\s/i,
  new RegExp(`\\s(?:para|a fim de|de modo a)\\s${VERB_PT}`, 'i'),
  /,?\s(?:antes de|até|by|before)\s(?=\d{1,2}(?:[/\-.]\d|h\b|:\d|\s?(?:dias?|days?|de\s|[ap]m\b)))/i,
  /,\s(?:se|if|caso|quando|when)\s/i,
  /\s(?:com margem|if needed|if necessary)\b/i,
  /\s(?:conforme|incluindo|including|as per)\s/i,
];

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** "Re: Fwd: [EXTERNAL] Subject" → "Subject". */
export function cleanSubject(subject: string): string {
  let s = (subject || '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 6; i++) {
    const t = s.replace(/^(?:(?:re|fw|fwd|enc|res|aw|wg|tr|r)(?:-\d+)?\s*:\s*|\[[^\]]*\]\s*)/i, '');
    if (t === s) break;
    s = t;
  }
  return s;
}

/** A cut can leave a dangling conjunction or preposition ("…já foi paga e"): drop it. */
const DANGLING = /\s+(?:e|and|ou|or|de|do|da|dos|das|para|com|em|no|na|nos|nas|a|o|à|ao|the|to|for|of|with|at|by|in|on)$/i;

function cap(s: string): string {
  s = s.replace(/[\s.,;:]+$/g, '');
  for (let i = 0; i < 3 && DANGLING.test(s); i++) s = s.replace(DANGLING, '');
  if (s.length <= MAX) return s;
  const cut = s.lastIndexOf(' ', MAX - 1);
  return s.slice(0, cut > MAX / 2 ? cut : MAX - 1).replace(/[\s.,;:(]+$/g, '') + '…';
}

/** Shorten a "next action" sentence: drop parentheses and preambles, cut at the first natural break, cap the length. */
export function shortTitle(action: string, subject?: string): string {
  let s = (action || '').replace(/\s+/g, ' ').trim();
  if (!s) return cap(cleanSubject(subject || '')) || '';
  if (GENERIC.some(re => re.test(s))) {
    const subj = cleanSubject(subject || '');
    if (subj) return cap(subj);
  }
  s = s.replace(/\s*\([^)]*\)/g, '');
  s = s.replace(/^(?:por favor|please)[,:]?\s+/i, '');
  s = s.replace(/^(?:carla|barbara|você|voce)\s+(?:deve|precisa|should|needs to|must)\s+/i, '');
  let best = s.length;
  for (const re of CUTS) {
    const m = re.exec(s);
    if (m && m.index > 0 && m.index < best && words(s.slice(0, m.index)) >= 3) best = m.index;
  }
  s = s.slice(0, best);
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return cap(s) || cap(cleanSubject(subject || ''));
}

/** What a task is called on a card: its Notion title, or a shortened next action. */
export function taskTitle(t: { title?: string | null; action: string; subject: string }): string {
  const own = (t.title || '').trim();
  return own || shortTitle(t.action, t.subject) || t.subject || t.action;
}
