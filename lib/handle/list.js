/**
 * @import {Info, State} from 'mdast-util-to-markdown'
 * @import {List, Parents} from 'mdast'
 */

import {checkBullet} from '../util/check-bullet.js'
import {checkBulletOther} from '../util/check-bullet-other.js'
import {checkBulletOrdered} from '../util/check-bullet-ordered.js'
import {checkListMarkerStrategy} from '../util/check-list-marker-strategy.js'
import {checkRule} from '../util/check-rule.js'

/**
 * Serialize a list node.
 *
 * @param {List} node
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
export function list(node, parent, state, info) {
  const exit = state.enter('list')
  const bulletCurrent = state.bulletCurrent
  /** @type {string} */
  const bullet =
    checkListMarkerStrategy(state) === 'context'
      ? contextListMarker(node, parent, state)
      : defaultListMarker(node, parent, state)

  state.bulletCurrent = bullet
  const value = state.containerFlow(node, info)
  state.bulletLastUsed = bullet
  state.bulletCurrent = bulletCurrent
  exit()
  return value
}

/**
 * Pick a list marker the default way: from the configured preferred markers,
 * switched to the alternate marker when the previously serialized list used
 * the same one, or when the marker could form a thematic break.
 *
 * @param {List} node
 *   List to serialize.
 * @param {Parents | undefined} parent
 *   Parent node.
 * @param {State} state
 *   Info passed around.
 * @returns {string}
 *   Marker to use.
 */
function defaultListMarker(node, parent, state) {
  /** @type {string} */
  let bullet = node.ordered ? checkBulletOrdered(state) : checkBullet(state)
  /** @type {string} */
  const bulletOther = node.ordered
    ? bullet === '.'
      ? ')'
      : '.'
    : checkBulletOther(state)
  let useDifferentMarker =
    parent && state.bulletLastUsed ? bullet === state.bulletLastUsed : false

  if (
    !node.ordered &&
    thematicBreakRisk(node, state, ownIndex(state), bullet)
  ) {
    useDifferentMarker = true
  }

  if (useDifferentMarker) {
    bullet = bulletOther
  }

  return bullet
}

/**
 * Pick a list marker explicitly from the surrounding sibling context:
 * look at the adjacent blocks in the parent and choose a marker that does
 * not merge with a neighboring list and cannot form a thematic break or an
 * indented code block.
 *
 * Nesting and ordered start numbers are not affected by this: they are
 * handled separately when serializing the list items.
 *
 * @param {List} node
 *   List to serialize.
 * @param {Parents | undefined} parent
 *   Parent node.
 * @param {State} state
 *   Info passed around.
 * @returns {string}
 *   Marker to use.
 */
function contextListMarker(node, parent, state) {
  const candidates = listMarkerCandidates(node, state, ownIndex(state))
  const forbidden = previousListMarker(node, parent, state)
  return pickMarker(candidates, forbidden)
}

/**
 * Get the ordered list of markers that may be used for a list, most
 * preferred first.
 *
 * Markers that could turn into a thematic break are moved to the end.
 *
 * @param {List} node
 *   List to serialize.
 * @param {State} state
 *   Info passed around.
 * @param {number} index
 *   Index of the list in its parent.
 * @returns {Array<string>}
 *   Candidate markers, most preferred first.
 */
function listMarkerCandidates(node, state, index) {
  if (node.ordered) {
    const marker = checkBulletOrdered(state)
    return [marker, marker === '.' ? ')' : '.']
  }

  const marker = checkBullet(state)
  const markerOther = checkBulletOther(state)
  /** @type {Array<string>} */
  const candidates = [marker, markerOther]
  const rest = ['*', '-', '+']
  let i = -1

  while (++i < rest.length) {
    if (!candidates.includes(rest[i])) {
      candidates.push(rest[i])
    }
  }

  if (thematicBreakRisk(node, state, index, marker)) {
    // The preferred marker could become a thematic break: try it last.
    candidates.push(/** @type {string} */ (candidates.shift()))
  }

  return candidates
}

/**
 * Find the marker used by the nearest previous sibling list of the same
 * kind (ordered or unordered), which the current list must not repeat,
 * because two adjacent lists with the same marker merge into one when
 * parsed again.
 *
 * @param {List} node
 *   List to serialize.
 * @param {Parents | undefined} parent
 *   Parent node.
 * @param {State} state
 *   Info passed around.
 * @returns {string | undefined}
 *   Marker used by the previous adjacent sibling list, if any.
 */
function previousListMarker(node, parent, state) {
  if (!parent || !parent.children) {
    return undefined
  }

  const index = ownIndex(state)
  const ordered = Boolean(node.ordered)
  let start = index

  // Find the start of the run of adjacent sibling lists of the same kind.
  while (start > 0) {
    const sibling = parent.children[start - 1]

    if (sibling.type === 'list' && Boolean(sibling.ordered) === ordered) {
      start--
    } else {
      break
    }
  }

  if (start === index) {
    return undefined
  }

  // Replay the choices made for the lists before us in this run.
  /** @type {string | undefined} */
  let marker
  let current = start - 1

  while (++current < index) {
    const sibling = /** @type {List} */ (parent.children[current])
    marker = pickMarker(listMarkerCandidates(sibling, state, current), marker)
  }

  return marker
}

/**
 * Pick the most preferred candidate that differs from a forbidden marker.
 *
 * @param {Array<string>} candidates
 *   Candidate markers, most preferred first.
 * @param {string | undefined} forbidden
 *   Marker that must not be used, if any.
 * @returns {string}
 *   Marker to use.
 */
function pickMarker(candidates, forbidden) {
  // Note: `candidates` always holds two or more different markers, so this
  // always finds one.
  return /** @type {string} */ (
    candidates.find(function (candidate) {
      return candidate !== forbidden
    })
  )
}

/**
 * Get the index of the node currently being serialized in its parent.
 *
 * @param {State} state
 *   Info passed around.
 * @returns {number}
 *   Index in the parent, or `-1` when there is no parent.
 */
function ownIndex(state) {
  return state.indexStack.length > 0
    ? state.indexStack[state.indexStack.length - 1]
    : -1
}

/**
 * Check whether a list marker could turn into a thematic break.
 *
 * @param {List} node
 *   List to serialize.
 * @param {State} state
 *   Info passed around.
 * @param {number} index
 *   Index of the list in its parent.
 * @param {string} bullet
 *   Preferred marker.
 * @returns {boolean}
 *   Whether the marker could form a thematic break.
 */
function thematicBreakRisk(node, state, index, bullet) {
  const firstListItem = node.children ? node.children[0] : undefined

  // If there is an empty first list item directly in two list items,
  // we have to use a different bullet:
  //
  // ```markdown
  // * - *
  // ```
  //
  // ...because otherwise it would become one big thematic break.
  if (
    // Bullet could be used as a thematic break marker:
    (bullet === '*' || bullet === '-') &&
    // Empty first list item:
    firstListItem &&
    (!firstListItem.children || !firstListItem.children[0]) &&
    // Directly in two other list items:
    state.stack[state.stack.length - 1] === 'list' &&
    state.stack[state.stack.length - 2] === 'listItem' &&
    state.stack[state.stack.length - 3] === 'list' &&
    state.stack[state.stack.length - 4] === 'listItem' &&
    // That are each the first child.
    index === 0 &&
    state.indexStack[state.indexStack.length - 2] === 0 &&
    state.indexStack[state.indexStack.length - 3] === 0
  ) {
    return true
  }

  // If there is a thematic break at the start of the first list item,
  // we have to use a different bullet:
  //
  // ```markdown
  // * ---
  // ```
  //
  // ...because otherwise it would become one big thematic break.
  if (checkRule(state) === bullet && firstListItem) {
    let itemIndex = -1

    while (++itemIndex < node.children.length) {
      const item = node.children[itemIndex]

      if (
        item &&
        item.type === 'listItem' &&
        item.children &&
        item.children[0] &&
        item.children[0].type === 'thematicBreak'
      ) {
        return true
      }
    }
  }

  return false
}
