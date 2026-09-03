import type { Review } from '../lib/types';

const map: Record<Review, [string, string, string]> = {
  'Pending review': ['var(--warning-soft)', 'var(--warning)', 'Draft ready'],
  'Approved': ['var(--success-soft)', 'var(--success)', 'Approved'],
  'Changes requested': ['var(--danger-soft)', 'var(--danger)', 'Changes asked'],
  'Barbara to handle': ['var(--info-soft)', 'var(--info)', 'With Barbara'],
};

export function reviewLabel(review: Review | null): string | null {
  return review ? map[review]?.[2] ?? null : null;
}

export function ReviewPill({ review, large, fallback }: { review: Review | null; large?: boolean; fallback?: string }) {
  const m = review ? map[review] : undefined;
  if (!m) return fallback ? <span className={`review-pill${large ? ' lg' : ''}`}>{fallback}</span> : null;
  return <span className={`review-pill${large ? ' lg' : ''}`} style={{ background: m[0], color: m[1] }}>{m[2]}</span>;
}
