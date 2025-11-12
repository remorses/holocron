import { createHash } from 'crypto'
import { prisma } from 'db'
import { env } from './env'
import { AppError } from './errors'
import { getOctokit } from 'website/src/lib/github.server'

// Utility to get client IP from request, handling Cloudflare proxy headers
function getClientIp(request: Request): string {
  // Cloudflare adds the real IP in CF-Connecting-IP header
  const cfIp = request.headers.get('CF-Connecting-IP')
  if (cfIp) return cfIp

  // Fallback to X-Forwarded-For
  const forwardedFor = request.headers.get('X-Forwarded-For')
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim()
  }

  // Fallback to X-Real-IP
  const realIp = request.headers.get('X-Real-IP')
  if (realIp) return realIp

  // Default fallback
  return '0.0.0.0'
}

// Utility to hash IP address using SHA-256
function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

export async function submitRateFeedback({
  request,
  branchId,
  url,
  opinion,
  message,
}: {
  request: Request
  branchId: string
  url: string
  opinion: 'good' | 'bad'
  message: string
}): Promise<{ success: boolean; githubUrl?: string }> {
  // Get client IP and hash it
  const clientIp = getClientIp(request)
  const ipHash = hashIp(clientIp)

  // Check rate limit: max 5 feedbacks per hour per IP
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentFeedbackCount = await prisma.pageFeedback.count({
    where: {
      ipHash,
      createdAt: {
        gte: oneHourAgo,
      },
    },
  })

  if (recentFeedbackCount >= 5) {
    throw new AppError('You have reached the feedback limit. Please try again later (max 5 feedbacks per hour).')
  }

  // Check user has access to the site
  const site = await prisma.site.findFirst({
    where: {
      branches: {
        some: { branchId },
      },
    },
    include: {
      githubInstallations: {
        where: {
          appId: env.GITHUB_APP_ID,
        },
        include: {
          github: true,
        },
      },
    },
  })

  if (!site) {
    throw new AppError('Site not found or access denied')
  }

  const DocsCategory = 'Docs Feedback'
  let discussionUrl = `https://github.com/${site.githubOwner}/${site.githubRepo}/discussions`

  const githubInstallation = site.githubInstallations.find((x) => x.appId === env.GITHUB_APP_ID)
  // Create GitHub discussion using GraphQL API
  if (githubInstallation?.github?.oauthToken) {
    try {
      const octokit = await getOctokit({
        installationId: githubInstallation.installationId,
      })

      // Get repository info and discussion categories
      const repositoryInfo: {
        repository: {
          id: string
          discussionCategories: {
            nodes: { id: string; name: string }[]
          }
        }
      } = await octokit.graphql(`
                query {
                    repository(owner: "${site.githubOwner}", name: "${site.githubRepo}") {
                        id
                        discussionCategories(first: 25) {
                            nodes { id name }
                        }
                    }
                }
            `)

      const repository = repositoryInfo.repository
      const category = repository.discussionCategories.nodes.find((cat) => cat.name === DocsCategory)

      if (!category) {
        console.warn(`Discussion category "${DocsCategory}" not found in repository`)
        // Fall back to creating issue instead
        const issueTitle = `Documentation feedback: ${url}`
        const issueBody = `**Feedback Type:** ${opinion}\n**Page URL:** ${url}\n**User Message:**\n\n${message}\n\n> Forwarded from user feedback on docs site.`

        if (!site.githubOwner || !site.githubRepo) {
          throw new AppError('GitHub owner and repo must be set for the site')
        }
        const { data: issue } = await octokit.rest.issues.create({
          owner: site.githubOwner,
          repo: site.githubRepo,
          title: issueTitle,
          body: issueBody,
          labels: ['documentation', 'feedback', opinion === 'bad' ? 'bug' : 'enhancement'],
        })

        discussionUrl = issue.html_url
      } else {
        const title = `Feedback for ${url}`
        const body = `[${opinion}] ${message}\n\n> Forwarded from user feedback.`

        // Search for existing discussion
        const searchResult: {
          search: {
            nodes: { id: string; url: string }[]
          }
        } = await octokit.graphql(`
                    query {
                        search(type: DISCUSSION, query: ${JSON.stringify(`${title} in:title repo:${site.githubOwner}/${site.githubRepo}`)}, first: 1) {
                            nodes {
                                ... on Discussion { id, url }
                            }
                        }
                    }
                `)

        const existingDiscussion = searchResult.search.nodes[0]

        if (existingDiscussion) {
          // Add comment to existing discussion
          await octokit.graphql(`
                        mutation {
                            addDiscussionComment(input: { body: ${JSON.stringify(body)}, discussionId: "${existingDiscussion.id}" }) {
                                comment { id }
                            }
                        }
                    `)
          discussionUrl = existingDiscussion.url
        } else {
          // Create new discussion
          const result: {
            createDiscussion: {
              discussion: { id: string; url: string }
            }
          } = await octokit.graphql(`
                        mutation {
                            createDiscussion(input: {
                                repositoryId: "${repository.id}",
                                categoryId: "${category.id}",
                                body: ${JSON.stringify(body)},
                                title: ${JSON.stringify(title)}
                            }) {
                                discussion { id, url }
                            }
                        }
                    `)

          discussionUrl = result.createDiscussion.discussion.url
        }
      }
    } catch (error) {
      console.error('Failed to create GitHub discussion for feedback:', error)
      // Don't throw error - feedback will still be saved
    }
  }

  // Store feedback in database
  await prisma.pageFeedback.create({
    data: {
      branchId,
      url,
      opinion,
      message,
      discussionUrl,
      ipHash,
    },
  })

  return {
    success: true,
    githubUrl: discussionUrl,
  }
}
