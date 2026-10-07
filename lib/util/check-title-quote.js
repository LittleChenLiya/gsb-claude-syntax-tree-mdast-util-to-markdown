/**
 * @import {State} from 'mdast-util-to-markdown'
 */

import {checkQuote} from './check-quote.js'

/**
 * Pick the shortest delimiters for a title that serialize safely.
 *
 * Titles can be wrapped in double quotes (`"a"`), apostrophes (`'a'`), or
 * parentheses (`(a)`).
 * Each pair of delimiters costs two characters, but characters in the title
 * that clash with the delimiters must be escaped, costing one extra
 * character each.
 * This picks the shortest representation, preferring the configured quote,
 * then the other quote, then parentheses, when equally short.
 *
 * @param {State} state
 *   Info passed around.
 * @param {string} title
 *   Title to serialize.
 * @returns {{open: string, close: string, name: 'titleApostrophe' | 'titleParen' | 'titleQuote'}}
 *   How to wrap the title.
 */
export function checkTitleQuote(state, title) {
  const quote = checkQuote(state)
  const other = quote === '"' ? "'" : '"'

  /** @type {Array<{open: string, close: string, name: 'titleApostrophe' | 'titleParen' | 'titleQuote'}>} */
  const candidates = [
    {
      open: quote,
      close: quote,
      name: quote === '"' ? 'titleQuote' : 'titleApostrophe'
    },
    {
      open: other,
      close: other,
      name: other === '"' ? 'titleQuote' : 'titleApostrophe'
    },
    {open: '(', close: ')', name: 'titleParen'}
  ]

  let result = candidates[0]
  let min = Infinity

  for (const candidate of candidates) {
    const cost = escapes(candidate, title)

    if (cost >= min) {
      continue
    }

    min = cost
    result = candidate
  }

  return result
}

/**
 * Count how many characters in `title` would need to be escaped when
 * wrapped in the given delimiters.
 *
 * @param {{open: string, close: string}} candidate
 *   Delimiters.
 * @param {string} title
 *   Title to serialize.
 * @returns {number}
 *   Number of characters that would need an escape.
 */
function escapes(candidate, title) {
  let count = 0

  for (const character of title) {
    if (character !== candidate.open && character !== candidate.close) {
      continue
    }

    count++
  }

  return count
}
