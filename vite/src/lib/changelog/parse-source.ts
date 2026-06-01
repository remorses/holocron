/**
 * Parse a changelog source URL into a structured descriptor.
 *
 * The `changelog` tab field is a full URL so future platforms (GitLab,
 * Gitea, etc.) can be supported by dispatching on the hostname. Today only
 * GitHub is implemented. Keeping the parser isolated makes it unit-testable
 * and keeps the provider focused on fetching + rendering.
 */

export type ChangelogSource = {
  platform: 'github'
  owner: string
  repo: string
  /** Canonical releases page URL, used in the generated "generated from" notice. */
  releasesUrl: string
}

/**
 * Parse a changelog source URL.
 *
 * Accepts a full GitHub repository URL such as
 * `https://github.com/owner/repo` (with or without a trailing
 * `/releases`, `.git`, or extra path segments).
 *
 * Throws a descriptive error for unsupported hosts or malformed URLs.
 */
export function parseChangelogSource(input: string): ChangelogSource {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new Error(
      `[holocron] changelog source "${input}" is not a valid URL. ` +
      `Use a full repository URL, e.g. "https://github.com/owner/repo".`,
    )
  }

  const host = url.hostname.replace(/^www\./, '')
  if (host !== 'github.com') {
    throw new Error(
      `[holocron] changelog source host "${host}" is not supported. ` +
      `Only github.com is supported today (e.g. "https://github.com/owner/repo").`,
    )
  }

  const segments = url.pathname.split('/').filter(Boolean)
  const owner = segments[0]
  const repo = segments[1]?.replace(/\.git$/, '')
  if (!owner || !repo) {
    throw new Error(
      `[holocron] changelog source "${input}" must include an owner and repository, ` +
      `e.g. "https://github.com/owner/repo".`,
    )
  }

  return {
    platform: 'github',
    owner,
    repo,
    releasesUrl: `https://github.com/${owner}/${repo}/releases`,
  }
}
