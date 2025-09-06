import { ToolPreviewContainer, Dot } from 'docs-website/src/components/chat-tool-previews'
import type { customsearch_v1 } from '@googleapis/customsearch'

interface GoogleSearchPreviewProps {
  part: {
    toolCallId: string
    input?: { query?: string }
    output?: customsearch_v1.Schema$Search
  }
}

export function WebSearchGooglePreview({ part }: GoogleSearchPreviewProps) {
  const searchData = part.output
  const query = part.input?.query || ''

  return (
    <ToolPreviewContainer>
      <div>
        <Dot toolCallId={part.toolCallId} /> Google Search: "{query}"
      </div>

      {searchData?.items && searchData.items.length > 0 && (
        <div className="flex flex-col gap-1">
          {searchData.items.slice(0, 5).map((result: any, idx: number) => (
            <div key={idx} className="flex whitespace-pre-wrap gap-2">
              <div className="shrink-0">{idx === 0 ? '⎿' : '  '}</div>
              <div className="flex flex-col gap-0.5">
                <a
                  href={result.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm flex items-center gap-1"
                >
                  <span className="text-muted-foreground">■</span>
                  {result.title}
                </a>
                <span className="text-muted-foreground text-xs ml-5 line-clamp-1">
                  {result.displayLink || result.link}
                </span>
              </div>
            </div>
          ))}
          {searchData.items.length > 5 && (
            <div className="flex gap-2">
              <div className="shrink-0">  </div>
              <span className="text-muted-foreground text-xs">
                ... and {searchData.items.length - 5} more results
              </span>
            </div>
          )}
        </div>
      )}

      {searchData?.searchInformation && (
        <div className="flex gap-2 text-xs text-muted-foreground mt-1">
          <div className="shrink-0">  </div>
          <span>
            About {searchData.searchInformation.formattedTotalResults} results 
            ({searchData.searchInformation.formattedSearchTime})
          </span>
        </div>
      )}
    </ToolPreviewContainer>
  )
}