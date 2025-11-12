'use client'

import { Markdown } from 'contesto/src/lib/markdown'
import { MediaAsset, PageMediaAsset } from 'db'
import { buttonVariants } from 'docs-website/src/components/ui/button'
import { cn } from 'docs-website/src/lib/cn'
import { WEBSITE_DOMAIN } from 'docs-website/src/lib/env'
import frontMatter from 'front-matter'
import {
    PageArticle,
    PageBreadcrumb,
    PageFooter,
    PageLastUpdate,
    PageRoot,
    PageTOC,
    PageTOCItems,
    PageTOCPopover,
    PageTOCPopoverContent,
    PageTOCPopoverItems,
    PageTOCPopoverTrigger,
    PageTOCTitle,
} from 'fumadocs-ui/layouts/docs/page'
import {
    Edit3Icon,
    ExternalLinkIcon,
    EyeIcon,
    GithubIcon,
    LinkedinIcon,
    MessageCircleIcon,
    TwitterIcon
} from 'lucide-react'
import { lazy, Suspense, useEffect } from 'react'
import { useLoaderData, useRevalidator, useRouteLoaderData, isRouteErrorResponse } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import { AskAIButton, LLMCopyButton, ViewOptions } from '../components/llm'
import { mdxComponents } from '../components/mdx-components'
import { PasswordProtection } from '../components/password-protection'
import { PoweredBy } from '../components/poweredby'
import { Rate } from '../components/rate'
import { ScalarOpenApi } from '../components/scalar'
import { useScrollToFirstAddedIfAtTop } from '../lib/diff-highlight'
import { DocsJsonType } from '../lib/docs-json'
import { updateFileInDocsEditor, useDocsState } from '../lib/docs-state'
import { useDocsJson } from '../lib/hooks'
import { MarkdownRuntime } from '../lib/markdown-runtime'
import { ProcessorDataFrontmatter } from '../lib/mdx-heavy'
import { renderNode } from '../lib/mdx-render-node'
import type { Route } from './+types/_catchall.$'
import type { Route as RootRoute } from './_catchall'

// Remove chatId cookie on page unload at module level
if (typeof window !== 'undefined') {
  const removeChatIdCookie = () => {
    document.cookie = 'chatId=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
  }

  window.addEventListener('beforeunload', removeChatIdCookie)
  // window.addEventListener('pagehide', removeChatIdCookie)
}

type MediaAssetProp = PageMediaAsset & { asset?: MediaAsset }

export function ClientPage(props: Route.ComponentProps) {
  const { type } = props.loaderData

  // Set global variable only when window is defined (client-side)
  if (typeof window !== 'undefined') {
    globalThis.lastServerLoaderData = props.loaderData
  }
  const rootData = useRouteLoaderData('routes/_catchall') as RootRoute.ComponentProps['loaderData']
  const docsJson = rootData?.docsJson as DocsJsonType

  if (type === 'openapi_scalar') {
    const { openapiUrl } = props.loaderData

    return <ScalarOpenApi url={openapiUrl} />
  }
  if (props.loaderData.type === 'openapi_fumadocs') {
    const { openapiUrl, processedOpenAPI, operations } = props.loaderData

    return null
    // return (
    //     <APIPageInner
    //         {...{
    //             processed: processedOpenAPI,
    //             hasHead: false,
    //             operations,
    //             // disablePlayground: true,
    //         }}
    //     />
    // )
  }
  return <PageContent {...props} />
}

function PageContent(props: Route.ComponentProps): any {
  const loaderData = props.loaderData
  const rootData = (useRouteLoaderData('routes/_catchall') as RootRoute.ComponentProps['loaderData']) || {}
  const { slug, slugs, githubPath, lastEditedAt } = loaderData || {}
  const owner = rootData.githubOwner
  const repo = rootData.githubRepo
  const githubBranch = rootData.githubBranch
  const branchId = rootData.branchId
  let { title, description, toc, previewMode, markdown } = useDocsState(
    useShallow((state) => {
      const { title, description } = loaderData || {}
      const { filesInDraft, previewMode } = state

      const override = filesInDraft[loaderData.githubPath]
      const toc = state.toc || loaderData?.toc
      if (override) {
        const { attributes: data } = frontMatter<ProcessorDataFrontmatter>(override.content || '')

        return {
          toc,
          title: data.title || title,
          description: data.description || description,
          previewMode,
          markdown: override.content || '',
        }
      }

      return {
        title,
        description,
        toc,
        previewMode,
        markdown: loaderData.markdown || '',
      }
    }),
  )
  const githubUrl = `https://github.com/${owner}/${repo}`
  const tableOfContentStyle = 'clerk'

  const docsJson = useDocsJson()
  const isEditorDisabled = docsJson?.disableEditButton === true

  // Early return for editor mode (only if editor is not disabled)
  if (previewMode === 'editor' && !isEditorDisabled) {
    return (
      <PageRoot>
        <PageArticle className='docs-page-article !pt-0'>
          <Suspense
            fallback={
              <div className='flex items-center justify-center h-96'>
                <div className='text-muted-foreground'>{/* Loading editor... */}</div>
              </div>
            }
          >
            <MonacoMarkdownEditor
              value={markdown}
              onChange={(value) => {
                updateFileInDocsEditor(loaderData.githubPath, value || '')
              }}
            />
          </Suspense>
        </PageArticle>
      </PageRoot>
    )
  }

  return (
    <PageRoot
      toc={{
        toc: toc as any,
      }}
    >
      {toc?.length > 0 && (
        <PageTOCPopover>
          <PageTOCPopoverTrigger />
          <PageTOCPopoverContent>
            <PageTOCPopoverItems />
          </PageTOCPopoverContent>
        </PageTOCPopover>
      )}
      <PageArticle className='docs-page-article'>
        <PageBreadcrumb />
        <h1 className='text-3xl font-semibold'>{title}</h1>
        <p className='text-lg text-fd-muted-foreground'>{description}</p>
        <div className='flex flex-row gap-2 items-center border-b pb-6'>
          <LLMCopyButton slug={slugs} contextual={docsJson?.contextual} />
          <ViewOptions
            markdownUrl={`${slug}.mdx`}
            githubUrl={owner && repo ? `https://github.com/${owner}/${repo}/blob/${githubBranch}/${githubPath}` : undefined}
            contextual={docsJson?.contextual}
          />
          {!isEditorDisabled && <EditorToggle />}
          <AskAIButton />
        </div>

        <div className='prose flex-1 text-fd-foreground/80'>
          <DocsMarkdown />
        </div>
        <div className='grow'></div>
        <Rate
          onRateAction={async (url, feedback) => {
            const apiUrl = new URL('/api/submitRateFeedback', process.env.PUBLIC_URL || `https://${WEBSITE_DOMAIN}`)
            const response = await fetch(apiUrl.toString(), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                branchId,
                url,
                opinion: feedback.opinion,
                message: feedback.message,
              }),
            })

            if (!response.ok) {
              throw new Error('Failed to submit feedback')
            }

            const result = await response.json()
            return { githubUrl: result.githubUrl }
          }}
        />
        <div className='flex items-center gap-2'>
          {lastEditedAt && <PageLastUpdate date={lastEditedAt} />}
          <div className='grow'></div>
          <PoweredBy />
        </div>

        <Footer footer={docsJson?.footer} />
        <PageFooter />
      </PageArticle>

      <PageTOC>
        <PageTOCTitle />
        <PageTOCItems variant={tableOfContentStyle} />
      </PageTOC>
    </PageRoot>
  )
}

function Footer({ footer }: { footer?: any }): any {
  if (!footer) return null

  // Calculate responsive grid columns based on number of link columns
  const numColumns = footer.links?.length || 0
  const gridCols =
    numColumns === 1
      ? 'grid-cols-1'
      : numColumns === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : numColumns === 3
          ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
          : numColumns === 4
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            : numColumns === 5
              ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6'

  return (
    <div className='flex flex-col gap-4 border-t pt-4'>
      {/* Social Links */}
      {footer.socials && (
        <div className='flex gap-3'>
          {Object.entries(footer.socials)
            .filter(([, url]: [string, any]) => url)
            .map(([platform, url]: [string, any]) => (
              <a
                key={platform}
                href={url}
                target='_blank'
                rel='noopener noreferrer'
                className='text-fd-muted-foreground hover:text-fd-foreground transition-colors'
                aria-label={platform}
              >
                <SocialIcon platform={platform} />
              </a>
            ))}
        </div>
      )}

      {/* Link Columns */}
      {footer.links && (
        <div className={`grid gap-6 ${gridCols}`}>
          {footer.links.map((column: any, index: number) => (
            <div key={index} className='flex flex-col gap-2'>
              {column.header && <h4 className='font-medium text-fd-foreground text-sm'>{column.header}</h4>}
              <div className='flex flex-col gap-1'>
                {column.items.map((item: any, itemIndex: number) => (
                  <a
                    key={itemIndex}
                    href={item.href}
                    target={item.href.startsWith('http') ? '_blank' : undefined}
                    rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className='text-sm text-fd-muted-foreground hover:text-fd-foreground transition-colors'
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SocialIcon({ platform }: { platform: string }) {
  const iconClass = 'w-4 h-4'

  switch (platform.toLowerCase()) {
    case 'github':
      return <GithubIcon className={iconClass} />
    case 'twitter':
    case 'x':
      return <TwitterIcon className={iconClass} />
    case 'discord':
      return <MessageCircleIcon className={iconClass} />
    case 'linkedin':
      return <LinkedinIcon className={iconClass} />
    default:
      return <ExternalLinkIcon className={iconClass} />
  }
}

function MdxErrorDisplay({ error, markdown }: { error: any; markdown: string }) {
  // Extract error details
  const errorLine = error.line || 1
  const errorColumn = error.column || 1
  const errorMessage = error.reason || error.message || 'Unknown error'

  // Split markdown into lines
  const lines = markdown.split('\n')

  // Calculate line range to show (5 lines before and after the error)
  const contextRange = 5
  const startLine = Math.max(1, errorLine - contextRange)
  const endLine = Math.min(lines.length, errorLine + contextRange)

  return (
    <div className='mt-[100px] bg-background p-8'>
      <div className='max-w-4xl mx-auto'>
        {/* Error Header */}
        <div className='bg-destructive/10 border border-destructive rounded-lg p-6 mb-6'>
          <h1 className='text-2xl font-bold text-destructive mb-2'>MDX Compilation Error</h1>
          <p className='text-base text-destructive/90'>{errorMessage}</p>
          <p className='text-sm text-muted-foreground mt-2'>
            Line {errorLine}, Column {errorColumn}
          </p>
        </div>

        {/* Code Context */}
        <div className='bg-muted/50 border border-border rounded-lg overflow-hidden'>
          <div className='bg-muted px-4 py-3 border-b border-border'>
            <h2 className='text-sm font-medium'>Error Context</h2>
          </div>
          <div className='p-0'>
            <pre className='text-sm overflow-x-auto'>
              <code>
                {lines.slice(startLine - 1, endLine).map((line, index) => {
                  const lineNumber = startLine + index
                  const isErrorLine = lineNumber === errorLine

                  return (
                    <div key={lineNumber} className={cn('flex', isErrorLine && 'bg-destructive/10')}>
                      {/* Line number */}
                      <span
                        className={cn(
                          'select-none px-4 py-1 text-muted-foreground border-r border-border',
                          isErrorLine && 'text-destructive font-medium',
                        )}
                      >
                        {lineNumber.toString().padStart(3, ' ')}
                      </span>

                      {/* Code line */}
                      <div className='flex-1 px-4 py-1'>
                        <span className={cn(isErrorLine && 'text-destructive')}>{line || ' '}</span>

                        {/* Error indicator */}
                        {isErrorLine && errorColumn && (
                          <div className='relative'>
                            <span
                              className='absolute text-destructive font-bold'
                              style={{
                                left: `${(errorColumn - 1) * 0.6}ch`,
                              }}
                            >
                              ^
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </code>
            </pre>
          </div>
        </div>

        {/* Additional error details if available */}
        {error.stack && (
          <details className='mt-6'>
            <summary className='cursor-pointer text-sm text-muted-foreground hover:text-foreground'>
              Show full stack trace
            </summary>
            <pre className='mt-2 p-4 bg-muted/50 border border-border rounded-lg text-xs overflow-x-auto'>
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

const components = {
  ...mdxComponents,
  // TODO do the same for Image?
  img(props) {
    const src = props.src || ''
    const { mediaAssets } = useLoaderData() as Route.ComponentProps['loaderData']

    const media = mediaAssets.find((asset) => asset.assetSlug === src)

    if (media) {
      return <mdxComponents.img width={media.asset?.width} height={media.asset?.height} {...props} />
    }
    return <mdxComponents.img {...props} />
  },
}

function importMonacoEditor() {
  return import('../components/monaco-markdown-editor').then((mod) => ({
    default: mod.MonacoMarkdownEditor,
  }))
}

const MonacoMarkdownEditor = lazy(() => importMonacoEditor())

// prefetch monaco component
if (typeof window !== 'undefined') {
  setTimeout(() => {
    importMonacoEditor()
  }, 1000)
}

function DocsMarkdown(): any {
  const loaderData = useLoaderData<Route.ComponentProps['loaderData']>()
  const showDiff = true
  useScrollToFirstAddedIfAtTop({ enabled: showDiff })
  // TODO now i disable highlight which now is ugly
  // useAddedHighlighter({ enabled: showDiff })
  const extension = loaderData.githubPath.split('.').pop()
  let { ast, markdown, isStreaming } = useDocsState(
    useShallow((x) => {
      const { filesInDraft, isMarkdownStreaming: isStreaming } = x

      const override = filesInDraft[loaderData.githubPath]

      if (override) {
        return {
          markdown: override.content || '',
          isStreaming,
          ast: undefined,
        }
      }
      console.log(`no override for githubPath ${loaderData.githubPath}, using loader data`)

      return {
        isStreaming,
        ast: loaderData.ast,
        markdown: loaderData.markdown || '',
      }
    }),
  )

  // Default preview mode
  if (!ast) {
    const previousMarkdown = loaderData.markdown || undefined
    return (
      <MarkdownRuntime
        className='page-content-markdown'
        {...{
          extension,
          isStreaming,
          showDiff,
          markdown,
          previousMarkdown,
        }}
      />
    )
  }
  return (
    <Markdown
      className='page-content-markdown'
      isStreaming={false}
      markdown={markdown}
      renderNode={renderNode}
      components={components}
      ast={ast}
    />
  )
}

function EditorToggle() {
  const contentMode = useDocsState((state) => state.previewMode)
  const docsJson = useDocsJson()
  const isEditorDisabled = docsJson?.disableEditButton === true

  // Don't render anything if editor is disabled
  if (isEditorDisabled) {
    return null
  }

  return (
    <button
      onClick={() => {
        useDocsState.setState((state) => ({
          ...state,
          previewMode: state.previewMode === 'editor' ? 'preview' : 'editor',
        }))
      }}
      className={cn(
        buttonVariants({
          variant: 'secondary',
          size: 'xs',
          className: 'gap-2',
        }),
      )}
    >
      {contentMode === 'editor' ? (
        <>
          <EyeIcon className='size-3.5' />
          Preview
        </>
      ) : (
        <>
          <Edit3Icon className='size-3.5' />
          Edit
        </>
      )}
    </button>
  )
}



export function ClientErrorBoundary({ error }: { error: Error }) {
  const revalidator = useRevalidator()
  const filesInDraft = useDocsState((state) => state.filesInDraft)



  if (isRouteErrorResponse(error) && error.status === 401) {
    return <PasswordProtection siteName={error.data?.siteName} />
  }

  const isRetryableErrorWithClientLoader = 'markdown' in (error as any) && (error as any).markdown

  useEffect(() => {
    if (isRetryableErrorWithClientLoader && Object.keys(filesInDraft).length > 0 && revalidator.state === 'idle') {
      console.log('Revalidating files in draft due to 404 error', filesInDraft)
      revalidator.revalidate()
    }
  }, [filesInDraft, isRetryableErrorWithClientLoader, revalidator.state])

  // Check if this is an MDX/remark error with line information
  const isMdxError = error instanceof Error && 'line' in error
  const markdown = error?.['markdown']

  if (isMdxError && markdown) {
    return <MdxErrorDisplay error={error} markdown={markdown} />
  }

  return null
}
