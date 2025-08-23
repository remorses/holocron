import { redirect } from 'react-router'
import type { Route } from './+types/github.pr.$owner.$repo.$branch.$'


// legacy holocron.so route. kept here to not break existing links in docs websites
export async function loader({ params }: Route.LoaderArgs) {
    const { owner, repo, branch, '*': filePath } = params

    if (!owner || !repo || !branch || !filePath) {
        throw new Response('Missing required parameters', { status: 400 })
    }

    const githubEditUrl = `https://github.com/${owner}/${repo}/edit/${branch}/${filePath}`

    throw redirect(githubEditUrl)
}
