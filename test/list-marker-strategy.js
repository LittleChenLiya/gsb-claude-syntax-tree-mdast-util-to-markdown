/**
 * Local acceptance checks for `options.listMarkerStrategy`.
 *
 * Run with: `npm run test-list-marker-strategy`.
 *
 * Covers three AST examples:
 *
 * 1. two adjacent lists followed by an indented code block
 * 2. two adjacent ordered lists, the second one starting at 3
 * 3. a nested tight list
 *
 * Plus: escaping must not change text characters, and the default
 * strategy must stay byte-for-byte identical to not passing
 * the option at all.
 *
 * @import {Options} from 'mdast-util-to-markdown'
 * @import {Code, List, ListItem, Paragraph, Root, Text} from 'mdast'
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {removePosition} from 'unist-util-remove-position'
import {fromMarkdown as from} from 'mdast-util-from-markdown'
import {toMarkdown as to} from 'mdast-util-to-markdown'

/**
 * Create a tight list item with a single paragraph of text.
 *
 * @param {string} value
 *   Text of the item.
 * @returns {ListItem}
 *   Tight list item.
 */
function item(value) {
  return {
    type: 'listItem',
    spread: false,
    children: [{type: 'paragraph', children: [{type: 'text', value}]}]
  }
}

// AST example 1: two adjacent unordered lists and an indented code block.
/** @type {Root} */
const exampleAdjacentListsAndCode = {
  type: 'root',
  children: [
    {
      type: 'list',
      ordered: false,
      spread: false,
      children: [item('alpha'), item('beta')]
    },
    {type: 'list', ordered: false, spread: false, children: [item('gamma')]},
    {type: 'code', value: 'console.log(1)'}
  ]
}

// AST example 2: two adjacent ordered lists, the second starting at 3.
/** @type {Root} */
const exampleOrderedFromThree = {
  type: 'root',
  children: [
    {
      type: 'list',
      ordered: true,
      start: 1,
      spread: false,
      children: [item('first')]
    },
    {
      type: 'list',
      ordered: true,
      start: 3,
      spread: false,
      children: [item('third'), item('fourth')]
    }
  ]
}

// AST example 3: a nested tight list.
/** @type {Root} */
const exampleNestedTight = {
  type: 'root',
  children: [
    {
      type: 'list',
      ordered: false,
      spread: false,
      children: [
        {
          type: 'listItem',
          spread: false,
          children: [
            {type: 'paragraph', children: [{type: 'text', value: 'a'}]},
            {
              type: 'list',
              ordered: false,
              spread: false,
              children: [item('b'), item('c')]
            }
          ]
        },
        item('d')
      ]
    }
  ]
}

test('listMarkerStrategy: context', async function (t) {
  await t.test(
    'example 1: should keep two adjacent lists and indented code as three blocks',
    async function () {
      /** @type {Options} */
      const options = {fences: false, listMarkerStrategy: 'context'}
      const value = to(exampleAdjacentListsAndCode, options)

      // The second list gets a different marker from its previous sibling,
      // and the indented code is kept apart from the list.
      assert.equal(
        value,
        '* alpha\n* beta\n\n- gamma\n\n<!---->\n\n    console.log(1)\n'
      )

      // Parsing again keeps the three blocks: two lists and a code block
      // (the injected `html` comment only separates them).
      const blocks = from(value).children.filter(function (node) {
        return node.type !== 'html'
      })

      assert.equal(blocks.length, 3)
      assert.deepEqual(
        blocks.map(function (node) {
          return node.type
        }),
        ['list', 'list', 'code']
      )

      const [first, second, code] = blocks
      assert.equal(first.type, 'list')
      assert.equal(second.type, 'list')
      assert.equal(code.type, 'code')
      const firstList = /** @type {List} */ (first)
      const secondList = /** @type {List} */ (second)
      const codeBlock = /** @type {Code} */ (code)

      // Both lists stay tight and keep their items.
      assert.equal(firstList.spread, false)
      assert.equal(secondList.spread, false)
      assert.deepEqual(
        firstList.children.map(function (d) {
          const paragraph = /** @type {Paragraph} */ (d.children[0])
          assert.equal(paragraph.type, 'paragraph')
          const text = /** @type {Text} */ (paragraph.children[0])
          assert.equal(text.type, 'text')
          return text.value
        }),
        ['alpha', 'beta']
      )
      assert.equal(codeBlock.value, 'console.log(1)')

      // Serializing the reparsed tree gives the same markdown again.
      assert.equal(to(from(value), options), value)
    }
  )

  await t.test(
    'example 2: should keep an ordered list starting at 3 starting at 3',
    async function () {
      /** @type {Options} */
      const options = {listMarkerStrategy: 'context'}
      const value = to(exampleOrderedFromThree, options)

      // Adjacent ordered lists get different delimiters; the start number
      // is handled separately from the marker choice.
      assert.equal(value, '1. first\n\n3) third\n4) fourth\n')

      const lists = from(value).children
      assert.equal(lists.length, 2)
      const [first, second] = /** @type {Array<List>} */ (lists)
      assert.equal(first.ordered, true)
      assert.equal(second.ordered, true)
      assert.equal(first.start, 1)
      assert.equal(second.start, 3)
      assert.equal(second.children.length, 2)

      assert.equal(to(from(value), options), value)
    }
  )

  await t.test(
    'example 3: should round-trip a nested tight list unchanged',
    async function () {
      /** @type {Options} */
      const options = {listMarkerStrategy: 'context'}
      const value = to(exampleNestedTight, options)

      assert.equal(value, '* a\n  * b\n  * c\n* d\n')

      // Same node structure as differently indented equivalent markdown.
      assert.deepEqual(
        removePosition(from(value), {force: true}),
        removePosition(from('* a\n    * b\n    * c\n* d\n'), {force: true})
      )

      // Tightness is preserved at both levels.
      const outer = /** @type {List} */ (from(value).children[0])
      assert.equal(outer.spread, false)
      const nested = /** @type {List} */ (outer.children[0].children[1])
      assert.equal(nested.type, 'list')
      assert.equal(nested.spread, false)

      assert.equal(to(from(value), options), value)
    }
  )

  await t.test(
    'should not change text characters when escaping',
    async function () {
      const values = [
        '1. not a list',
        'a * b',
        '- dash',
        '# hash',
        '1) x',
        '[a](b)',
        '`code`',
        'a+b',
        '***',
        'foo_bar'
      ]

      const actual = values.map(function (value) {
        /** @type {Root} */
        const tree = {
          type: 'root',
          children: [{type: 'paragraph', children: [{type: 'text', value}]}]
        }
        const markdown = to(tree, {listMarkerStrategy: 'context'})
        const paragraph = /** @type {Paragraph} */ (from(markdown).children[0])
        assert.equal(paragraph.type, 'paragraph')
        const text = /** @type {Text} */ (paragraph.children[0])
        assert.equal(text.type, 'text')
        return text.value
      })

      assert.deepEqual(actual, values)
    }
  )

  await t.test(
    'should keep the default strategy byte-for-byte identical',
    async function () {
      const examples = [
        exampleAdjacentListsAndCode,
        exampleOrderedFromThree,
        exampleNestedTight
      ]

      assert.deepEqual(
        examples.map(function (example) {
          return to(example, {fences: false})
        }),
        examples.map(function (example) {
          return to(example, {fences: false, listMarkerStrategy: 'default'})
        })
      )
    }
  )
})
