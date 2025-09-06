import array from 'x-is-array'
import object from 'is-object'
import proto from 'getprototypeof'
import { size } from 'unist-util-size'

import type { Root, Parent, Literal, Text, Content as MdContent } from 'mdast'

declare module 'mdast' {
  export interface HProperties {
    id?: string
    'data-added'?: boolean | string
  }
  export interface Data {
    hProperties?: HProperties
  }
}

type DiffNode = Root | Parent | MdContent | null

interface DiffPatch {
  type: 'remove' | 'insert' | 'replace' | 'text' | 'props' | 'order'
  left: DiffNode
  right: DiffNode | Record<string, any> | MoveInfo | null
}

interface MoveInfo {
  removes: Array<{ left: DiffNode; right: number | string }>
  inserts: Array<{ left: DiffNode; right: number | string }>
}

interface PatchResult {
  left: DiffNode
  [index: number]: DiffPatch | DiffPatch[]
}

interface KeyIndexResult {
  key: Record<string, number>
  index: string[]
}

interface ReorderResult {
  children: DiffNode[]
  moves: MoveInfo | null
}

const objectProto = Object.prototype

const ignoredKeys = ['type', 'children', 'value']

export default diff

function diff(left: Root, right: Root): PatchResult {
  const patch: PatchResult = { left: left }
  walk(left, right, patch, 0)
  return patch
}

function walk(left: DiffNode, right: DiffNode, patch: PatchResult, index: number): void {
  let apply = patch[index]

  if (left === right) {
    return
  }

  if (!right) {
    const removePatch: DiffPatch = {
      type: 'remove',
      left: left,
      right: null,
    }
    apply = append(apply, removePatch)
  } else if (!left) {
    const insertPatch: DiffPatch = {
      type: 'insert',
      left: null,
      right: right,
    }
    apply = append(apply, insertPatch)
  } else if (left.type === right.type) {
    const propsResult = diffProperties(apply, left, right)
    if (propsResult) apply = propsResult

    if (text(right)) {
      const textResult = diffText(apply, left as Text, right as Text)
      if (textResult) apply = textResult
    } else if (parent(right)) {
      const childrenResult = diffChildren(apply, left as Parent, right as Parent, patch, index)
      if (childrenResult) apply = childrenResult
    }
  } else {
    const replacePatch: DiffPatch = {
      type: 'replace',
      left: left,
      right: right,
    }
    apply = append(apply, replacePatch)
  }

  if (apply) {
    patch[index] = apply
  }
}

function diffText(
  apply: DiffPatch | DiffPatch[] | undefined,
  left: Text,
  right: Text,
): DiffPatch | DiffPatch[] | undefined {
  return left.value === right.value ? apply : append(apply, { type: 'text', left: left, right: right })
}

function diffChildren(
  apply: DiffPatch | DiffPatch[] | undefined,
  left: Parent,
  right: Parent,
  patch: PatchResult,
  offset: number,
): DiffPatch | DiffPatch[] | undefined {
  const leftChildren = left.children
  const ordered = reorder(leftChildren, right.children)
  const children = ordered.children
  const length = children.length
  let index = -1
  let leftChild: DiffNode
  let rightChild: DiffNode

  while (++index < length) {
    leftChild = leftChildren[index]
    rightChild = children[index]
    offset++

    if (leftChild) {
      walk(leftChild, rightChild, patch, offset)
    } else {
      apply = append(apply, {
        type: 'insert',
        left: null,
        right: rightChild,
      })
    }

    offset += size(leftChild)
  }

  if (ordered.moves) {
    apply = append(apply, {
      type: 'order',
      left: left,
      right: ordered.moves,
    })
  }

  return apply
}

function diffProperties(
  apply: DiffPatch | DiffPatch[] | undefined,
  left: DiffNode,
  right: DiffNode,
): DiffPatch | DiffPatch[] | undefined {
  const diff = diffObjects(left, right)
  return diff ? append(apply, { type: 'props', left: left, right: diff }) : apply
}

function diffObjects(left: any, right: any): Record<string, any> | undefined {
  let diff: Record<string, any> | undefined
  let leftKey: string
  let rightKey: string
  let leftValue: any
  let rightValue: any
  let objectDiff: Record<string, any> | undefined

  for (leftKey in left) {
    if (ignoredKeys.indexOf(leftKey) !== -1) {
      continue
    }

    if (!(leftKey in right)) {
      diff = diff || {}
      diff[leftKey] = undefined
    }

    leftValue = left[leftKey]
    rightValue = right[leftKey]

    if (leftValue === rightValue) {
      continue
    }

    if (
      object(leftValue) &&
      object(rightValue) &&
      proto(rightValue) === objectProto &&
      proto(leftValue) === objectProto
    ) {
      objectDiff = diffObjects(leftValue, rightValue)

      if (objectDiff) {
        diff = diff || {}
        diff[leftKey] = objectDiff
      }
    } else {
      diff = diff || {}
      diff[leftKey] = rightValue
    }
  }

  for (rightKey in right) {
    if (ignoredKeys.indexOf(rightKey) !== -1) {
      continue
    }

    if (!(rightKey in left)) {
      diff = diff || {}
      diff[rightKey] = right[rightKey]
    }
  }

  return diff
}

function append(apply: DiffPatch | DiffPatch[] | undefined, patch: DiffPatch): DiffPatch | DiffPatch[] {
  if (!apply) {
    return patch
  }

  if (array(apply)) {
    ;(apply as DiffPatch[]).push(patch)
    return apply as DiffPatch[]
  }

  return [apply as DiffPatch, patch]
}

function reorder(leftChildren: DiffNode[], rightChildren: DiffNode[]): ReorderResult {
  let leftChildIndex = keyIndex(leftChildren)
  let leftKeys = leftChildIndex.key
  let leftIndex = leftChildIndex.index
  const rightChildIndex = keyIndex(rightChildren)
  const rightKeys = rightChildIndex.key
  const rightIndex = rightChildIndex.index
  let leftLength = leftChildren.length
  const rightLength = rightChildren.length
  let leftOffset = 0
  let rightOffset = 0
  const rightMoved: number[] = []
  const leftMoved: number[] = []
  const removes: Array<{ left: DiffNode; right: number | string }> = []
  const inserts: Array<{ left: DiffNode; right: number | string }> = []
  const next: DiffNode[] = []
  let index = -1
  let leftKey: string
  let rightKey: string

  while (++index < leftLength) {
    leftKey = leftIndex[index]

    if (leftKey in rightKeys) {
      next.push(rightChildren[rightKeys[leftKey]])
    } else {
      next.push(null)
    }
  }

  index = -1

  while (++index < rightLength) {
    if (!(rightIndex[index] in leftKeys)) {
      next.push(rightChildren[index])
    }
  }

  const finalChildren = next
  leftChildIndex = keyIndex(finalChildren)
  leftKeys = leftChildIndex.key
  leftIndex = leftChildIndex.index
  leftLength = finalChildren.length
  rightKey = rightIndex[rightOffset]
  leftKey = leftIndex[leftOffset]

  while (leftOffset < leftLength || rightOffset < rightLength) {
    /* The left node moved already. */
    if (leftMoved.indexOf(leftOffset) !== -1) {
      removes.push({ left: finalChildren[leftOffset], right: leftOffset })
      leftKey = leftIndex[++leftOffset]
      /* The right node moved already. */
    } else if (rightMoved.indexOf(rightOffset) !== -1) {
      removes.push({
        left: rightChildren[rightOffset],
        right: leftKeys[rightKey],
      })
      rightKey = rightIndex[++rightOffset]
    } else if (!rightKey) {
      leftKey = leftIndex[++leftOffset]
    } else if (!leftKey) {
      rightKey = rightIndex[++rightOffset]
    } else if (rightKey === leftKey) {
      leftKey = leftIndex[++leftOffset]
      rightKey = rightIndex[++rightOffset]
    } else if (leftKeys[rightKey] - leftOffset >= rightKeys[leftKey] - rightOffset) {
      inserts.push({
        left: rightChildren[rightOffset],
        right: rightOffset,
      })
      leftMoved.push(leftKeys[rightKey])
      rightKey = rightIndex[++rightOffset]
    } else {
      inserts.push({
        left: finalChildren[leftOffset],
        right: rightKeys[leftKey],
      })
      rightMoved.push(rightKeys[leftKey])
      leftKey = leftIndex[++leftOffset]
    }
  }

  if (removes.length === 0 && inserts.length === 0) {
    return { children: finalChildren, moves: null }
  }

  return {
    children: finalChildren,
    moves: { removes: removes, inserts: inserts },
  }
}

function keyIndex(children: DiffNode[]): KeyIndexResult {
  const keys: Record<string, number> = {}
  const indices: string[] = []
  const length = children.length
  const counts: Record<string, number> = {}
  let index = -1
  let child: DiffNode
  let key: string

  while (++index < length) {
    child = children[index]

    if (!child) {
      continue
    }

    key = syntheticKey(child)

    if (key in counts) {
      key = key + ':' + counts[key]++
    } else {
      counts[key] = 1
    }

    indices[index] = key
    keys[key] = index
  }

  return { key: keys, index: indices }
}

function syntheticKey(node: DiffNode): string {
  const props: Record<string, any> = {}
  let key: string

  if (!node) return 'null'

  for (key in node) {
    if (ignoredKeys.indexOf(key) === -1) {
      props[key] = (node as any)[key]
    }
  }

  return node.type + ':' + JSON.stringify(props)
}

function parent(value: any): value is Parent {
  return node(value) && !!value && 'children' in value
}

function text(value: any): value is Text {
  return node(value) && !!value && 'value' in value
}

function node(value: any): value is DiffNode {
  return value !== null && value !== undefined && object(value) && 'type' in value
}
