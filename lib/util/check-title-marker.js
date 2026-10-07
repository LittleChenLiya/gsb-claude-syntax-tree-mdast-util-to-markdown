/**
 * @import {SafeConfig, State} from 'mdast-util-to-markdown'
 */

import {checkQuote} from './check-quote.js'

/**
 * Choose the shortest marker for a title that round-trips safely.
 *
 * Titles can be wrapped in double quotes (`"`), apostrophes (`'`), or
 * parentheses (`()`).
 * All markers take up the same space, so what matters is how much escaping
 * the value itself needs: fewer escapes means a shorter result.
 * The preferred quote (`options.quote`) is tried first, then the other
 * quote, then parentheses.
 * When every marker conflicts with the value, the first (preferred) marker
 * of the shortest results is used, with the conflicting characters escaped
 * by the regular `safe` mechanism.
 *
 * @param {State} state
 *   Info passed around about the current state.
 * @param {string} title
 *   Title to serialize.
 * @param {SafeConfig} config
 *   Configuration for `state.safe`, describing what is around the title.
 * @returns {'"' | "'" | '()'}
 *   Marker to use for the title.
 */
export function checkTitleMarker(state, title, config) {
  const quote = checkQuote(state)
  /** @type {Array<'"' | "'" | '()'>} */
  const markers = quote === '"' ? ['"', "'", '()'] : ["'", '"', '()']
  /** @type {string | undefined} */
  let best
  /** @type {'"' | "'" | '()'} */
  let bestMarker = quote
  let index = -1

  while (++index < markers.length) {
    const marker = markers[index]
    const open = marker === '()' ? '(' : marker
    const close = marker === '()' ? ')' : marker
    const exit = state.enter(
      marker === '()'
        ? 'titleParen'
        : marker === '"'
          ? 'titleQuote'
          : 'titleApostrophe'
    )
    const result = state.safe(title, {
      ...config,
      before: config.before + ' ' + open,
      after: close + config.after
    })
    exit()

    if (best === undefined || result.length < best.length) {
      best = result
      bestMarker = marker
    }

    // Nothing needed escaping: this cannot be improved upon.
    if (result === title) break
  }

  return bestMarker
}
