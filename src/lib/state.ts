import type { AppData, Highlight, Rating, Settings } from '@/dashboard/types'
import { createSeedData, dateKey } from '@/dashboard/data'
import {
  getMeta,
  listDocs,
  listHighlights,
  listSources,
  setMeta,
} from './db'

const DAY_MS = 86_400_000

export function getState(): AppData {
  const seed = createSeedData()
  const settings = getMeta<Settings>('settings', seed.settings)
  return {
    version: 1,
    docs: listDocs(),
    highlights: listHighlights(),
    sources: listSources(),
    settings: { ...seed.settings, ...settings },
    review: { ...seed.review, ...getMeta('review', seed.review) },
    integrations: { ...seed.integrations, ...getMeta('integrations', seed.integrations) },
    imports: getMeta('imports', seed.imports),
  }
}

export function schedule(
  highlight: Pick<Highlight, 'reviewCount' | 'intervalDays' | 'ease' | 'lapses'>,
  rating: Rating,
  now = Date.now(),
): { intervalDays: number; ease: number; lapses: number; dueAt: string } {
  let interval = Number(highlight.intervalDays ?? 0)
  let ease = Number(highlight.ease ?? 2.5)
  let lapses = Number(highlight.lapses ?? 0)

  if (!highlight.reviewCount) {
    interval = rating === 'again' ? 0.007 : rating === 'hard' ? 1 : rating === 'good' ? 3 : 7
  } else if (rating === 'again') {
    interval = 0.007
    ease = Math.max(1.3, ease - 0.25)
    lapses += 1
  } else if (rating === 'hard') {
    interval = Math.max(1, interval * 1.2)
    ease = Math.max(1.3, ease - 0.05)
  } else if (rating === 'good') {
    interval = Math.max(1, interval * ease)
  } else {
    interval = Math.max(2, interval * ease * 1.25)
    ease = Math.min(3, ease + 0.1)
  }

  interval = Math.min(interval, 730)
  return {
    intervalDays: interval,
    ease,
    lapses,
    dueAt: new Date(now + interval * DAY_MS).toISOString(),
  }
}

export function applyReview(highlight: Highlight, rating: Rating): { highlight: Highlight; review: AppData['review'] } {
  const review = { ...getMeta('review', createSeedData().review) }
  const today = dateKey()
  if (review.reviewsDate !== today) {
    review.reviewsDate = today
    review.reviewsToday = 0
  }
  review.reviewsToday += 1
  if (review.lastReviewDate !== today) {
    const yesterday = dateKey(new Date(Date.now() - DAY_MS))
    review.streak = review.lastReviewDate === yesterday ? review.streak + 1 : 1
    review.lastReviewDate = today
  }

  const next = schedule(highlight, rating)
  return {
    highlight: {
      ...highlight,
      reviewCount: highlight.reviewCount + 1,
      lastReviewed: new Date().toISOString(),
      intervalDays: next.intervalDays,
      ease: next.ease,
      lapses: next.lapses,
      dueAt: next.dueAt,
    },
    review,
  }
}

export function saveReview(review: AppData['review']): void {
  setMeta('review', review)
}
