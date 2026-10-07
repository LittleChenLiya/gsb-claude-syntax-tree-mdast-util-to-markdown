/**
 * @import {Options, State} from 'mdast-util-to-markdown'
 */

/**
 * Checks the preferred hard break option.
 *
 * @param {State} state
 *   Info passed around.
 * @returns {Exclude<Options['hardBreak'], null | undefined>}
 *   Preferred hard break marker.
 */
export function checkHardBreak(state) {
  const marker = state.options.hardBreak || '\\'

  if (marker !== '\\' && marker !== '  ') {
    throw new Error(
      'Cannot serialize break with `' +
        marker +
        '` for `options.hardBreak`, expected `\\` or `  `'
    )
  }

  return marker
}
