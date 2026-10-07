/**
 * @import {Info, State} from 'mdast-util-to-markdown'
 * @import {Image, Parents} from 'mdast'
 */

import {checkTitleQuote} from '../util/check-title-quote.js'

image.peek = imagePeek

/**
 * Serialize an image node.
 *
 * @param {Image} node
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
export function image(node, _, state, info) {
  const exit = state.enter('image')
  let subexit = state.enter('label')
  const tracker = state.createTracker(info)
  let value = tracker.move('![')
  value += tracker.move(
    state.safe(node.alt, {before: value, after: ']', ...tracker.current()})
  )
  value += tracker.move('](')

  subexit()

  if (
    // If there’s no url but there is a title…
    (!node.url && node.title) ||
    // If there are control characters or whitespace.
    /[\0- \u007F]/.test(node.url)
  ) {
    subexit = state.enter('destinationLiteral')
    value += tracker.move('<')
    value += tracker.move(
      state.safe(node.url, {before: value, after: '>', ...tracker.current()})
    )
    value += tracker.move('>')
  } else {
    // No whitespace, raw is prettier.
    subexit = state.enter('destinationRaw')
    value += tracker.move(
      state.safe(node.url, {
        before: value,
        after: node.title ? ' ' : ')',
        ...tracker.current()
      })
    )
  }

  subexit()

  if (node.title) {
    const title = checkTitleQuote(state, node.title)
    subexit = state.enter(title.name)
    value += tracker.move(' ' + title.open)
    value += tracker.move(
      state.safe(node.title, {
        before: value,
        after: title.close,
        ...tracker.current()
      })
    )
    value += tracker.move(title.close)
    subexit()
  }

  value += tracker.move(')')
  exit()

  return value
}

/**
 * Peek at this node.
 *
 * @returns {string}
 *   Start of the serialized markdown.
 */
function imagePeek() {
  return '!'
}
