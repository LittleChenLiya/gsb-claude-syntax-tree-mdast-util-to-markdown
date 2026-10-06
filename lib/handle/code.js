/**
 * @import {Info, Map, State} from 'mdast-util-to-markdown'
 * @import {Code, Nodes, Parents} from 'mdast'
 */

import {longestStreak} from 'longest-streak'
import {formatCodeAsIndented} from '../util/format-code-as-indented.js'
import {checkFence} from '../util/check-fence.js'
import {checkListMarkerStrategy} from '../util/check-list-marker-strategy.js'

/**
 * Serialize a code node.
 *
 * @param {Code} node
 *   Node to serialize.
 * @param {Parents | undefined} parent
 *   Parent node.
 * @param {State} state
 *   Info passed around.
 * @param {Info} info
 *   Info on surrounding context.
 * @returns {string}
 *   Serialized markdown.
 */
export function code(node, parent, state, info) {
  const marker = checkFence(state)
  const raw = node.value || ''
  let indented = formatCodeAsIndented(node, state)

  // With the contextual list marker strategy, an indented code block that
  // directly follows a list or another indented code block would be merged
  // into that previous block when reparsed.
  // Fence such a code block instead, so that the blocks stay separate
  // without injecting an HTML comment between them.
  if (indented && checkListMarkerStrategy(state) === 'contextual' && parent) {
    const siblings = /** @type {Array<Nodes>} */ (parent.children)
    const index = siblings.indexOf(node)
    const previous = index > 0 ? siblings[index - 1] : undefined

    if (
      previous &&
      (previous.type === 'list' ||
        (previous.type === 'code' && formatCodeAsIndented(previous, state)))
    ) {
      indented = false
    }
  }

  if (indented) {
    const exit = state.enter('codeIndented')
    const value = state.indentLines(raw, map)
    exit()
    return value
  }

  const tracker = state.createTracker(info)
  const sequence = marker.repeat(Math.max(longestStreak(raw, marker) + 1, 3))
  const exit = state.enter('codeFenced')
  const suffix = marker === '`' ? 'GraveAccent' : 'Tilde'
  let value = tracker.move(sequence)

  if (node.lang) {
    const subexit = state.enter(`codeFencedLang${suffix}`)
    value += tracker.move(
      state.safe(node.lang, {
        before: value,
        after: ' ',
        encode: ['`'],
        ...tracker.current()
      })
    )
    subexit()
  }

  if (node.lang && node.meta) {
    const subexit = state.enter(`codeFencedMeta${suffix}`)
    value += tracker.move(' ')
    value += tracker.move(
      state.safe(node.meta, {
        before: value,
        after: '\n',
        encode: ['`'],
        ...tracker.current()
      })
    )
    subexit()
  }

  value += tracker.move('\n')

  if (raw) {
    value += tracker.move(raw + '\n')
  }

  value += tracker.move(sequence)
  exit()
  return value
}

/**
 * Indent lines w/ code indent.
 *
 * @type {Map}
 */
function map(line, _, blank) {
  return (blank ? '' : '    ') + line
}
