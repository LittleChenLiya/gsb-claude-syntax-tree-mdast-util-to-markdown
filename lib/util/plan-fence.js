/**
 * @import {State} from 'mdast-util-to-markdown'
 */

import {longestStreak} from 'longest-streak'
import {checkFence} from './check-fence.js'

/**
 * Plan an explicit fence for a fenced code block, before anything is
 * written.
 *
 * The marker and its length are chosen up front, based on the info string
 * and the content, instead of always writing three fixed markers:
 *
 * *   a backtick fence cannot have backticks in its info string, so when
 *     the info contains a backtick, the legal tilde form is used instead;
 * *   an info string also cannot start with the fence marker, as that would
 *     extend the opening fence run and change how the fence parses;
 * *   the fence is made longer than the longest streak of the marker in the
 *     content (and at least three markers), so the content cannot close the
 *     fence early;
 * *   if neither marker fits the info string, an error is thrown before a
 *     single character is serialized, so no half-written markdown results.
 *
 * @param {string} info
 *   Raw info string (language and meta) of the code block.
 * @param {string} value
 *   Raw content of the code block.
 * @param {State} state
 *   Info passed around.
 * @returns {{marker: '`' | '~', sequence: string}}
 *   Fence plan: the marker to use and the fence sequence.
 */
export function planFence(info, value, state) {
  const preferred = checkFence(state)
  // Try the preferred marker first, then fall back to the legal alternative.
  /** @type {Array<'`' | '~'>} */
  const markers = preferred === '`' ? ['`', '~'] : ['~', '`']
  let index = -1

  while (++index < markers.length) {
    const marker = markers[index]

    if (fenceMarkerWorks(marker, info)) {
      // Make the fence longer than the longest streak of the marker in the
      // content, so the content cannot close the fence early.
      const size = Math.max(longestStreak(value, marker) + 1, 3)
      return {marker, sequence: marker.repeat(size)}
    }
  }

  throw new Error(
    'Cannot serialize code with info string `' +
      info +
      '`: the info is incompatible with both `` ` `` and `~` fences'
  )
}

/**
 * Check whether a fence marker works for an info string.
 *
 * @param {'`' | '~'} marker
 *   Fence marker to check.
 * @param {string} info
 *   Raw info string (language and meta).
 * @returns {boolean}
 *   Whether the marker can be used with the info string.
 */
function fenceMarkerWorks(marker, info) {
  // An info string starting with the marker would extend the opening fence
  // run, changing how the fence and info parse.
  if (info.charAt(0) === marker) return false
  // Backtick fences cannot have backticks in their info string (CommonMark).
  // Tilde fences may contain any other character.
  return marker === '~' || !info.includes('`')
}
