/**
 * @import {Options, State} from 'mdast-util-to-markdown'
 * @import {Code} from 'mdast'
 */

import {longestStreak} from 'longest-streak'

/**
 * Checks the preferred fence option.
 *
 * @param {State} state
 *   Info passed around.
 * @returns {Exclude<Options['fence'], null | undefined>}
 *   Preferred fence marker.
 */
export function checkFence(state) {
  const marker = state.options.fence || '`'

  if (marker !== '`' && marker !== '~') {
    throw new Error(
      'Cannot serialize code with `' +
        marker +
        '` for `options.fence`, expected `` ` `` or `~`'
    )
  }

  return marker
}

/**
 * @typedef {object} FencePlan
 *   Plan for fencing a code block.
 * @property {string} marker
 *   Fence marker to use.
 * @property {number} length
 *   Fence length to use.
 * @property {string} content
 *   Content to emit (including a trailing newline when non-empty).
 */

/**
 * Plan how to fence a code block.
 *
 * Picks a marker (backtick or tilde) based on the content and the info
 * string, and a length that is long enough to not be closed early by
 * streaks of the marker in the content.
 *
 * The plan is fully checked before it is returned, so that no partial
 * markdown is written when a code block cannot be fenced.
 *
 * @param {Code} node
 *   Node to serialize.
 * @param {string} preferred
 *   Preferred fence marker.
 * @param {string} raw
 *   Raw value.
 * @returns {FencePlan}
 *   Fence plan.
 */
export function planFence(node, preferred, raw) {
  const lang = node.lang || ''
  const meta = node.meta || ''
  const info = lang + (lang && meta ? ' ' : '') + meta

  let marker = preferred

  // A backtick fence cannot contain backticks in the info string, as that
  // would be interpreted as inline code instead.
  // Switch to tildes, which are a legal form, rather than encoding them.
  if (marker === '`' && info.includes('`')) {
    marker = '~'
  }

  // A tilde fence cannot have a language that starts with a tilde:
  // it merges into the opening fence run, which then cannot be closed.
  // Switch to backticks, which are a legal form.
  if (marker === '~' && lang.startsWith('~')) {
    marker = '`'
  }

  // If neither marker is legal, the code block cannot be fenced.
  if (marker === '`' && info.includes('`')) {
    throw new Error(
      'Cannot serialize code with `` ` `` for `options.fence` when the ' +
        'info string contains a grave accent, use tildes instead'
    )
  }

  // The fence must be longer than the longest streak of the marker in
  // the content, so that a line of the marker in the content does not
  // close the block early.
  const length = Math.max(longestStreak(raw, marker) + 1, 3)

  // Check the trailing newline against the AST semantics: an empty value
  // emits no content (an empty block), while a non-empty value emits the
  // value followed by a newline.
  const content = raw ? raw + '\n' : ''

  return {marker, length, content}
}
