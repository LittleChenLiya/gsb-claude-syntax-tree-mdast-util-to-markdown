/**
 * Acceptance examples for explicit fence planning of fenced code blocks.
 *
 * Run directly with Node:
 *
 * ```sh
 * node --conditions development test/fence-planning.js
 * ```
 *
 * or through npm:
 *
 * ```sh
 * npm run test-fence-planning
 * ```
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {fromMarkdown} from 'mdast-util-from-markdown'
import {toMarkdown} from 'mdast-util-to-markdown'

/**
 * Serialize a code node and parse the result back.
 *
 * @param {import('mdast').Code} node
 *   Code node to serialize.
 * @returns {{markdown: string, back: import('mdast').Code}}
 *   The markdown and the reparsed code node.
 */
function roundTrip(node) {
  const markdown = toMarkdown(node)
  const tree = fromMarkdown(markdown)
  assert.equal(tree.children.length, 1, 'expected a single node')
  const back = tree.children[0]
  assert.equal(back.type, 'code', 'expected a code node')
  return {markdown, back: /** @type {import('mdast').Code} */ (back)}
}

test('example 1: content with four consecutive backticks stays fully fenced', function () {
  /** @type {import('mdast').Code} */
  const node = {
    type: 'code',
    lang: 'markdown',
    meta: null,
    value: '````\nnot a closing fence\n````'
  }
  const {markdown, back} = roundTrip(node)

  // A fence of five grave accents is planned, so the four in the content
  // cannot close the block early.
  assert.equal(
    markdown,
    '`````markdown\n````\nnot a closing fence\n````\n`````\n'
  )
  assert.equal(back.value, node.value, 'content must not be truncated')
  assert.equal(back.lang, 'markdown')
})

test('example 2: info with a backtick switches to a tilde fence', function () {
  /** @type {import('mdast').Code} */
  const node = {type: 'code', lang: 'a`b', meta: 'c`d', value: 'x'}
  const {markdown, back} = roundTrip(node)

  // Backticks are illegal in the info of a backtick fence, so the legal
  // tilde form is planned instead.
  assert.equal(markdown, '~~~a`b c`d\nx\n~~~\n')
  assert.equal(back.lang, 'a`b')
  assert.equal(back.meta, 'c`d')
  assert.equal(back.value, 'x')
})

test('example 3: reparsed content is not truncated by inner fences', function () {
  /** @type {import('mdast').Code} */
  const node = {
    type: 'code',
    lang: null,
    meta: null,
    value: '```\ncode\n~~~\nmore\n```'
  }
  const {markdown, back} = roundTrip(node)

  assert.equal(markdown, '````\n```\ncode\n~~~\nmore\n```\n````\n')
  assert.equal(back.value, node.value, 'content must survive a reparse')

  // Serializing the reparsed node gives the same markdown again.
  assert.equal(toMarkdown(back), markdown, 'serialization must be stable')
})

test('example 4: an empty code block round-trips', function () {
  /** @type {import('mdast').Code} */
  const node = {type: 'code', lang: null, meta: null, value: ''}
  const {markdown, back} = roundTrip(node)

  assert.equal(markdown, '```\n```\n')
  assert.equal(back.value, '')
  assert.equal(back.lang, null)
  assert.equal(back.meta, null)
  assert.equal(toMarkdown(back), markdown, 'serialization must be stable')
})
