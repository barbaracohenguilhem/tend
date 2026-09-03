import type { Task } from './types';

const LIGHT_CATEGORIES = ['System / Notification', 'Newsletter / Information', 'Spam / Promotion'];
/** Account-security and housekeeping chores: the things you glance at and tap done. */
const LIGHT_WORDS = /\b(login|log-in|sign-?in|senha|password|2fa|two-factor|autentica|verification code|c[oó]digo de (verifica|confirma|seguran)|c[oó]digo de acesso|security code|one-time|otp|novo dispositivo|new device|dispositivo desconhecido|unrecognized device|unsubscribe|cancelar (a )?inscri|newsletter|confirm(e|ar)? (your|seu|sua|o|a) (e-?mail|email|conta|account|endere[cç]o|address|subscription|assinatura)|was (this )?you|foi voc[eê]|recovery|recupera[cç][aã]o)/i;
/** Anything with money, paper or people in it is a decision, however "confirm-y" the wording. */
const HEAVY_WORDS = /\b(pay|pagar|pagamento|payment|deposit|dep[oó]sito|invoice|fatura|boleto|budget|or[cç]amento|quote|cota[cç][aã]o|proposta|proposal|contract|contrato|sign|assinar|purchase|compra|order|pedido|price|pre[cç]o|valor|r\$|us\$|\$|€|client|cliente|supplier|fornecedor|deliver|entrega|plan|plano|render|drawing|desenho|meeting|reuni[aã]o|approve|aprovar|send|enviar)\b/i;

export type Weight = 'key' | 'light';

/** Decision vs. quick check. LOLI's priority and category come first; the wording of the action is the tie-breaker. */
export function weightOf(t: Task): Weight {
  if (t.teamReview === 'Requested') return 'key';
  if (t.priority === 'High') return 'key';
  if (t.draft) return 'key'; // a proposed response is always a decision
  if (LIGHT_CATEGORIES.includes(t.category)) return 'light';
  if (t.priority === 'Low') return 'light';
  const text = `${t.action} ${t.subject}`;
  if (HEAVY_WORDS.test(text)) return 'key';
  if (LIGHT_WORDS.test(text)) return 'light';
  return 'key';
}

export function isBlocked(t: Task, all: Task[]): boolean {
  if (t.waitingOn) return true;
  return (t.dependsOn || []).some(id => { const d = all.find(x => x.id === id); return d ? !d.completed : false; });
}
