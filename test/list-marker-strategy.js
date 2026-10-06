/**
 * @import {List, Root} from 'mdast'
 */

import assert from 'node:assert/strict'
import test from 'node:test'
import {fromMarkdown} from 'mdast-util-from-markdown'
import {removePosition} from 'unist-util-remove-position'
import {toMarkdown} from '../index.js'

/**
 * Make an unordered tight list with a single item.
 *
 * @param {string} value
 *   Text of the single item.
 * @returns {List}
 *   List node.
 */
function unorderedList(value) {
  return {
    type: 'list',
    ordered: false,
    start: null,
    spread: false,
    children: [
      {
        type: 'listItem',
        spread: false,
        checked: null,
        children: [{type: 'paragraph', children: [{type: 'text', value}]}]
      }
    ]
  }
}

// AST example 1: two adjacent lists followed by an indented code block.
/** @type {Root} */
const adjacentListsWithIndentedCode = {
  type: 'root',
  children: [
    unorderedList('a'),
    unorderedList('b'),
    {type: 'code', lang: null, meta: null, value: 'x'}
  ]
}

// AST example 2: an ordered list that starts at 3.
/** @type {Root} */
const orderedListFromThree = {
  type: 'root',
  children: [
    {
      type: 'list',
      ordered: true,
      start: 3,
      spread: false,
      children: [
        {
          type: 'listItem',
          spread: false,
          checked: null,
          children: [
            {type: 'paragraph', children: [{type: 'text', value: 'a'}]}
          ]
        },
        {
          type: 'listItem',
          spread: false,
          checked: null,
          children: [
            {type: 'paragraph', children: [{type: 'text', value: 'b'}]}
          ]
        }
      ]
    }
  ]
}

// AST example 3: a tight list nested in another tight list.
/** @type {Root} */
const nestedTightList = {
  type: 'root',
  children: [
    {
      type: 'list',
      ordered: false,
      start: null,
      spread: false,
      children: [
        {
          type: 'listItem',
          spread: false,
          checked: null,
          children: [
            {type: 'paragraph', children: [{type: 'text', value: 'a'}]},
            {
              type: 'list',
              ordered: false,
              start: null,
              spread: false,
              children: [
                {
                  type: 'listItem',
                  spread: false,
                  checked: null,
                  children: [
                    {
                      type: 'paragraph',
                      children: [{type: 'text', value: 'b'}]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}

/**
 * Parse `value` and drop positional information.
 *
 * @param {string} value
 *   Markdown to parse.
 * @returns {Root}
 *   Parsed tree without positions.
 */
function parse(value) {
  const tree = fromMarkdown(value)
  removePosition(tree, {force: true})
  return tree
}

test('listMarkerStrategy', async function (t) {
  await t.test(
    'should keep two adjacent lists and indented code as three blocks',
    async function () {
      const value = toMarkdown(adjacentListsWithIndentedCode, {
        fences: false,
        listMarkerStrategy: 'contextual'
      })

      assert.equal(value, '* a\n\n- b\n\n```\nx\n```\n')
      assert.deepEqual(
        parse(value).children.map((d) => d.type),
        ['list', 'list', 'code']
      )
      assert.deepEqual(parse(value), adjacentListsWithIndentedCode)
    }
  )

  await t.test(
    'should not change the default stringify for adjacent lists and code',
    async function () {
      assert.equal(
        toMarkdown(adjacentListsWithIndentedCode, {fences: false}),
        '* a\n\n- b\n\n<!---->\n\n    x\n'
      )
      assert.equal(
        toMarkdown(adjacentListsWithIndentedCode, {
          fences: false,
          listMarkerStrategy: 'default'
        }),
        '* a\n\n- b\n\n<!---->\n\n    x\n'
      )
    }
  )

  await t.test(
    'should keep a list that starts at 3 starting at 3',
    async function () {
      const value = toMarkdown(orderedListFromThree, {
        listMarkerStrategy: 'contextual'
      })

      assert.equal(value, '3. a\n4. b\n')
      const back = parse(value)
      assert.equal(back.children[0].type, 'list')
      assert.equal(back.children[0].start, 3)
      assert.deepEqual(back, orderedListFromThree)
      // The default stringify is unchanged.
      assert.equal(toMarkdown(orderedListFromThree), '3. a\n4. b\n')
    }
  )

  await t.test(
    'should keep adjacent ordered lists separate and keep their starts',
    async function () {
      /** @type {Root} */
      const tree = {
        type: 'root',
        children: [
          {
            type: 'list',
            ordered: true,
            start: 3,
            spread: false,
            children: [
              {
                type: 'listItem',
                spread: false,
                checked: null,
                children: [
                  {type: 'paragraph', children: [{type: 'text', value: 'a'}]}
                ]
              }
            ]
          },
          {
            type: 'list',
            ordered: true,
            start: 1,
            spread: false,
            children: [
              {
                type: 'listItem',
                spread: false,
                checked: null,
                children: [
                  {type: 'paragraph', children: [{type: 'text', value: 'b'}]}
                ]
              }
            ]
          }
        ]
      }
      const value = toMarkdown(tree, {listMarkerStrategy: 'contextual'})

      assert.equal(value, '3. a\n\n1) b\n')
      assert.deepEqual(parse(value), tree)
    }
  )

  await t.test(
    'should round-trip a nested tight list unchanged',
    async function () {
      const value = toMarkdown(nestedTightList, {
        listMarkerStrategy: 'contextual'
      })

      // Tight: no blank lines, nested list indented to its parent item.
      assert.equal(value, '* a\n  * b\n')
      const back = parse(value)
      assert.deepEqual(back, nestedTightList)
      // Serializing the reparsed tree gives the same markdown again.
      assert.equal(toMarkdown(back, {listMarkerStrategy: 'contextual'}), value)
    }
  )

  await t.test(
    'should keep tight and loose list whitespace semantics',
    async function () {
      /** @type {Root} */
      const tree = {
        type: 'root',
        children: [
          {
            type: 'list',
            ordered: false,
            start: null,
            spread: true,
            children: [
              {
                type: 'listItem',
                spread: false,
                checked: null,
                children: [
                  {type: 'paragraph', children: [{type: 'text', value: 'a'}]}
                ]
              },
              {
                type: 'listItem',
                spread: false,
                checked: null,
                children: [
                  {type: 'paragraph', children: [{type: 'text', value: 'b'}]}
                ]
              }
            ]
          },
          unorderedList('c')
        ]
      }
      const value = toMarkdown(tree, {listMarkerStrategy: 'contextual'})

      // Loose list: blank line between items; tight list stays tight.
      assert.equal(value, '* a\n\n* b\n\n- c\n')
      const back = parse(value)
      assert.deepEqual(back, tree)
      // @ts-expect-error: checked by deepEqual.
      assert.equal(back.children[0].spread, true)
      // @ts-expect-error: checked by deepEqual.
      assert.equal(back.children[1].spread, false)
    }
  )

  await t.test(
    'should escape without changing literal text characters',
    async function () {
      const values = [
        'a * b',
        '*a*',
        'a_b',
        '# h',
        '1. x',
        '- x',
        '+ x',
        '[x](y)',
        'a < b',
        'a \\ b',
        '***',
        '    code'
      ]
      /** @type {Root} */
      const tree = {
        type: 'root',
        children: values.map((value) => ({
          type: 'paragraph',
          children: [{type: 'text', value}]
        }))
      }

      const asDefault = toMarkdown(tree, {listMarkerStrategy: 'default'})
      assert.deepEqual(parse(asDefault), tree)

      const asContextual = toMarkdown(tree, {
        listMarkerStrategy: 'contextual'
      })
      assert.deepEqual(parse(asContextual), tree)
    }
  )

  await t.test('should throw on an unknown strategy', async function () {
    assert.throws(function () {
      // @ts-expect-error: check how an invalid strategy is handled.
      toMarkdown(nestedTightList, {listMarkerStrategy: 'unknown'})
    }, /Cannot serialize with `unknown` for `options\.listMarkerStrategy`/)
  })
})

test('listMarkerStrategy edge cases', async function (t) {
  await t.test(
    'should alternate markers over three adjacent lists',
    async function () {
      /** @type {Root} */
      const tree = {
        type: 'root',
        children: [unorderedList('a'), unorderedList('b'), unorderedList('c')]
      }
      const value = toMarkdown(tree, {listMarkerStrategy: 'contextual'})

      assert.equal(value, '* a\n\n- b\n\n* c\n')
      assert.deepEqual(parse(value), tree)
    }
  )

  await t.test(
    'should not alternate between lists of different kinds',
    async function () {
      /** @type {Root} */
      const tree = {
        type: 'root',
        children: [
          unorderedList('a'),
          {
            type: 'list',
            ordered: true,
            start: 1,
            spread: false,
            children: [
              {
                type: 'listItem',
                spread: false,
                checked: null,
                children: [
                  {type: 'paragraph', children: [{type: 'text', value: 'b'}]}
                ]
              }
            ]
          },
          unorderedList('c')
        ]
      }
      const value = toMarkdown(tree, {listMarkerStrategy: 'contextual'})

      assert.equal(value, '* a\n\n1. b\n\n* c\n')
      assert.deepEqual(parse(value), tree)
    }
  )

  await t.test('should support a list as the whole tree', async function () {
    const value = toMarkdown(nestedTightList.children[0], {
      listMarkerStrategy: 'contextual'
    })

    assert.equal(value, '* a\n  * b\n')
  })

  await t.test(
    'should keep adjacent indented code blocks separate',
    async function () {
      /** @type {Root} */
      const tree = {
        type: 'root',
        children: [
          {type: 'code', lang: null, meta: null, value: 'a'},
          {type: 'code', lang: null, meta: null, value: 'b'}
        ]
      }
      const value = toMarkdown(tree, {
        fences: false,
        listMarkerStrategy: 'contextual'
      })

      assert.equal(value, '    a\n\n```\nb\n```\n')
      assert.deepEqual(parse(value), tree)
    }
  )

  await t.test(
    'should not fence indented code that does not follow a list or code',
    async function () {
      /** @type {Root} */
      const tree = {
        type: 'root',
        children: [
          {type: 'paragraph', children: [{type: 'text', value: 'a'}]},
          {type: 'code', lang: null, meta: null, value: 'b'}
        ]
      }
      const value = toMarkdown(tree, {
        fences: false,
        listMarkerStrategy: 'contextual'
      })

      assert.equal(value, 'a\n\n    b\n')
      assert.deepEqual(parse(value), tree)
    }
  )

  await t.test('should support code as the whole tree', async function () {
    const value = toMarkdown(
      {type: 'code', lang: null, meta: null, value: 'a'},
      {fences: false, listMarkerStrategy: 'contextual'}
    )

    assert.equal(value, '    a\n')
  })
})
