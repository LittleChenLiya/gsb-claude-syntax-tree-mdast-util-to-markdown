/**
 * @import {Options, State} from 'mdast-util-to-markdown'
 */

/**
 * Checks the list marker strategy option.
 *
 * @param {State} state
 *   Info passed around.
 * @returns {Exclude<Options['listMarkerStrategy'], null | undefined>}
 *   List marker strategy.
 */
export function checkListMarkerStrategy(state) {
  const strategy = state.options.listMarkerStrategy || 'default'

  if (strategy !== 'default' && strategy !== 'context') {
    throw new Error(
      'Cannot serialize items with `' +
        strategy +
        '` for `options.listMarkerStrategy`, expected `default` or `context`'
    )
  }

  return strategy
}
