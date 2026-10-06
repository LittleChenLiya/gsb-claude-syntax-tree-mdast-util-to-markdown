/**
 * @import {Info, Map, State} from 'mdast-util-to-markdown'
 * @import {Code, Parents} from 'mdast'
 */

import {formatCodeAsIndented} from '../util/format-code-as-indented.js'
import {planFence} from '../util/plan-fence.js'

/**
 * Serialize a code node.
 *
 * @param {Code} node
 *   Node to serialize.
 * @param {Parents | undefined} _
 *   Parent node.
 * @param {State} state
 *   Info passed around.
 * @param {Info} info
 *   Info on surrounding context.
 * @returns {string}
 *   Serialized markdown.
 */
export function code(node, _, state, info) {
  const raw = node.value || ''
  const infoString = node.lang
    ? node.lang + (node.meta ? ' ' + node.meta : '')
    : ''
  // Plan the whole fence up front, before anything is written: pick a
  // marker that is legal for the info string and a sequence long enough to
  // wrap the entire value, so no half-serialized markdown can result.
  const fence = planFence(infoString, raw, state)

  if (formatCodeAsIndented(node, state)) {
    const exit = state.enter('codeIndented')
    const value = state.indentLines(raw, map)
    exit()
    return value
  }

  const tracker = state.createTracker(info)
  const exit = state.enter('codeFenced')
  const suffix = fence.marker === '`' ? 'GraveAccent' : 'Tilde'
  let value = tracker.move(fence.sequence)

  if (node.lang) {
    const subexit = state.enter(`codeFencedLang${suffix}`)
    value += tracker.move(
      state.safe(node.lang, {
        before: value,
        after: ' ',
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
        ...tracker.current()
      })
    )
    subexit()
  }

  value += tracker.move('\n')

  if (raw) {
    // The closing fence has to be on its own line: add exactly one line
    // ending after the value. If the value itself already ends in a line
    // ending, that ending is part of the AST value and is kept as-is, so
    // the result parses back to the same value.
    value += tracker.move(raw + '\n')
  }

  value += tracker.move(fence.sequence)
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
