import { StructuredPatchHunk as Hunk, diffWordsWithSpace } from 'diff'
import * as React from 'react'

export const FileEditPreviewTitle = ({
  filePath,
  hunks,
  className,
}: {
  filePath: string
  hunks: Hunk[]
  className?: string
}) => {
  const numAdditions = hunks.reduce(
    (count, hunk) => count + hunk.lines.filter((_) => _.startsWith('+')).length,
    0,
  )
  const numRemovals = hunks.reduce(
    (count, hunk) => count + hunk.lines.filter((_) => _.startsWith('-')).length,
    0,
  )

  return (
    <Text className={className}>
      Updated <Text bold>{filePath}</Text>
      {numAdditions > 0 || numRemovals > 0 ? ' with ' : ''}
      {numAdditions > 0 ? (
        <>
          <Text bold>{numAdditions}</Text>{' '}
          {numAdditions > 1 ? 'additions' : 'addition'}
        </>
      ) : null}
      {numAdditions > 0 && numRemovals > 0 ? ' and ' : null}
      {numRemovals > 0 ? (
        <>
          <Text bold>{numRemovals}</Text>{' '}
          {numRemovals > 1 ? 'removals' : 'removal'}
        </>
      ) : null}
    </Text>
  )
}

export const FileEditPreview = ({
  hunks,
  paddingLeft = 0,
  className,
}: {
  hunks: Hunk[]
  paddingLeft?: number
  className?: string
}) => {
  return (
    <Box flexDirection='column' className={className}>
      {hunks.flatMap((patch, i) => {
        const elements = [
          <Box
            flexDirection='column'
            paddingLeft={paddingLeft}
            key={patch.newStart}
          >
            <StructuredDiff patch={patch} />
          </Box>,
        ]
        if (i < hunks.length - 1) {
          elements.push(
            <Box paddingLeft={paddingLeft} key={`ellipsis-${i}`}>
              <Text color='secondaryText'>...</Text>
            </Box>,
          )
        }
        return elements
      })}
    </Box>
  )
}

// Simple React components to replace Ink's Box and Text
const Box = ({
  children,
  flexDirection = 'row' as 'row' | 'column',
  paddingLeft = 0,
  className,
  ...props
}: {
  children?: React.ReactNode
  flexDirection?: 'row' | 'column'
  paddingLeft?: number
  className?: string
  [key: string]: any
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection,
        paddingLeft: `${paddingLeft * 0.5}rem`,
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  )
}

const Text = ({
  children,
  color,
  backgroundColor,
  bold,
  type,
  className,
  ...props
}: {
  children?: React.ReactNode
  color?: string
  backgroundColor?: string
  bold?: boolean
  type?: string
  className?: string
  [key: string]: any
}) => {
  const style: React.CSSProperties = {}

  // Use Tailwind's default color tokens
  if (color === 'error') style.color = 'var(--color-red-500)'
  if (color === 'secondaryText') style.color = 'var(--color-neutral-300)'
  if (color === 'addedLight') style.color = 'var(--color-green-100)'
  if (color === 'removedLight') style.color = 'var(--color-red-100)'

  if (backgroundColor) {
    // Use Tailwind color tokens with opacity via oklch
    const bgColors = {
      added: 'oklch(from var(--color-green-500) l c h / 40%)',
      // removedLight: 'oklch(from var(--color-red-400) l c h / 20%)',
      addedLight: 'oklch(from var(--color-green-400) l c h / 20%)',
      removed: 'oklch(from var(--color-red-500) l c h / 40%)',
    }
    style.backgroundColor = bgColors[backgroundColor]
  }

  // Text colors for word diffs
  if (type === 'added') style.color = 'var(--color-green-300)'
  if (type === 'removed') style.color = 'var(--color-red-300)'

  if (bold) style.fontWeight = 'bold'

  return (
    <span style={style} className={className} {...props}>
      {children}
    </span>
  )
}

// Helper function to get word-level diff
const getWordDiff = (oldLine: string, newLine: string) => {
  return diffWordsWithSpace(oldLine, newLine)
}

// StructuredDiff component
const StructuredDiff = ({ patch }: { patch: Hunk }) => {
  const formatDiff = (lines: string[], startingLineNumber: number) => {
    const processedLines = lines.map((code) => {
      if (code.startsWith('+')) {
        return {
          code: ' ' + code.slice(1),
          type: 'add',
          originalCode: code,
        }
      }
      if (code.startsWith('-')) {
        return {
          code: ' ' + code.slice(1),
          type: 'remove',
          originalCode: code,
        }
      }
      return { code, type: 'nochange', originalCode: code }
    })

    // Find pairs of removed/added lines for word-level diff
    const linePairs: Array<{ remove?: number; add?: number }> = []
    for (let i = 0; i < processedLines.length; i++) {
      if (processedLines[i].type === 'remove') {
        // Look ahead for corresponding add
        let j = i + 1
        while (
          j < processedLines.length &&
          processedLines[j].type === 'remove'
        ) {
          j++
        }
        if (j < processedLines.length && processedLines[j].type === 'add') {
          linePairs.push({ remove: i, add: j })
        }
      }
    }

    let lineNumber = startingLineNumber
    const result: Array<{
      code: React.ReactNode
      type: string
      lineNumber: number
    }> = []

    for (let i = 0; i < processedLines.length; i++) {
      const { code, type, originalCode } = processedLines[i]

      // Check if this line is part of a word-diff pair
      const pair = linePairs.find((p) => p.remove === i || p.add === i)

      if (pair && pair.remove === i && pair.add !== undefined) {
        // This is a removed line with a corresponding added line
        const removedText = processedLines[i].code
        const addedText = processedLines[pair.add].code
        const wordDiff = getWordDiff(removedText, addedText)

        // Create simple removed line display
        const removedContent = (
          <Text backgroundColor='removedLight'>
            <Text>-</Text>
            <Text type='removed'>{removedText}</Text>
          </Text>
        )

        result.push({ code: removedContent, type, lineNumber })
      } else if (pair && pair.add === i && pair.remove !== undefined) {
        // This is an added line with a corresponding removed line
        const removedText = processedLines[pair.remove].code
        const addedText = processedLines[i].code
        const wordDiff = getWordDiff(removedText, addedText)

        // Create word-level diff display for added line
        const addedContent = (
          <Text color='addedLight'>
            <Text>+</Text>
            {wordDiff.map((part, idx) => {
              if (part.added) {
                return (
                  <Text key={`added-${i}-${idx}`} type='added'>
                    {part.value}
                  </Text>
                )
              }
              return <Text key={`unchanged-${i}-${idx}`}>{part.value}</Text>
            })}
          </Text>
        )

        result.push({ code: addedContent, type, lineNumber })
      } else {
        // Regular line without word-level diff
        const content =
          type === 'add' || type === 'remove' ? (
            <Text color={type === 'add' ? 'addedLight' : 'removedLight'}>
              <Text>{type === 'add' ? '+' : '-'}</Text>
              {code}
            </Text>
          ) : (
            <Text className='text-muted-foreground'> {code}</Text>
          )

        result.push({ code: content, type, lineNumber })
      }

      if (type === 'nochange' || type === 'add') {
        lineNumber++
      }
    }

    const maxLineNumber = Math.max(...result.map((r) => r.lineNumber))
    const maxWidth = maxLineNumber.toString().length

    return result.map(({ type, code, lineNumber }, index) => {
      const lineNumberText = lineNumber.toString().padStart(maxWidth)

      return (
        <Text key={`line-${index}`}>
          <Text color='secondaryText'>{lineNumberText} </Text>
          {code}
        </Text>
      )
    })
  }

  const diff = formatDiff(patch.lines, patch.oldStart)
  return (
    <>
      {diff.map((line, i) => (
        <Box key={i}>{line}</Box>
      ))}
    </>
  )
}
