import { ToolPreviewContainer, Dot } from 'docs-website/src/components/chat-tool-previews'
import type { SearchData } from '@mendable/firecrawl-js'

interface WebSearchPreviewProps {
  part: {
    toolCallId: string
    input?: { query?: string }
    output?: SearchData
  }
}

export function WebSearchFirecrawlPreview({ part }: WebSearchPreviewProps) {
  const searchData = part.output
  const query = part.input?.query || ''

  return (
    <ToolPreviewContainer>
      <div>
        <Dot toolCallId={part.toolCallId} /> Web Search: "{query}"
      </div>

      {searchData?.web && searchData.web.length > 0 && (
        <div className="flex flex-col gap-1">
          {searchData.web.slice(0, 5).map((result: any, idx: number) => {
            const isDocument = 'markdown' in result
            const url = isDocument ? result.metadata?.sourceURL : result.url
            const title = isDocument ? result.metadata?.title : result.title
            const description = isDocument ? result.metadata?.description : result.description

            return (
              <div key={idx} className="flex whitespace-pre-wrap gap-2">
                <div className="shrink-0">{idx === 0 ? '⎿' : '  '}</div>
                <div className="flex flex-col gap-0.5">

                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary  hover:underline text-sm flex items-center gap-1"
                  >
                    <span className="text-muted-foreground">▪︎{' '}</span>
                    {title || url}
                  </a>
                  <span className="text-muted-foreground text-xs ml-5 line-clamp-1">
                    {url}
                  </span>
                </div>
              </div>
            )
          })}
          {searchData.web.length > 5 && (
            <div className="flex gap-2">
              <div className="shrink-0">  </div>
              <span className="text-muted-foreground text-xs">
                ... and {searchData.web.length - 5} more results
              </span>
            </div>
          )}
        </div>
      )}

      {searchData?.news && searchData.news.length > 0 && (
        <div className="flex flex-col gap-1 mt-2">
          <div className="flex gap-2">
            <div className="shrink-0">  </div>
            <span className="text-sm font-medium">News Results:</span>
          </div>
          {searchData.news.slice(0, 3).map((result: any, idx: number) => (
            <div key={idx} className="flex gap-2">
              <div className="shrink-0">  </div>
              <div className="flex flex-col gap-0.5">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm flex items-center gap-1"
                >
                  <span className="text-muted-foreground">□</span>
                  {result.title || result.url}
                </a>
                <span className="text-muted-foreground text-xs ml-5 line-clamp-1">
                  {result.url}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </ToolPreviewContainer>
  )
}
