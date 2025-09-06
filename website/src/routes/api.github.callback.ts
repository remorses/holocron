import { redirect, type LoaderFunctionArgs } from 'react-router'
import { getGithubApp, getOctokit } from 'website/src/lib/github.server'
import { App, OAuthApp } from 'octokit'
import * as cookie from 'cookie'

import { env } from 'website/src/lib/env'
import { safeJsoncParse } from 'website/src/lib/utils'

import { GithubAccountType, Prisma, prisma } from 'db'
import { getSession } from '../lib/better-auth'
import { GithubState, GithubLoginRequestData } from '../lib/types'
import { GITHUB_LOGIN_DATA_COOKIE } from './api.github.webhooks'

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const { userId } = await getSession({
    request,
  })
  if (!userId) {
    throw new Response('Unauthorized', { status: 401 })
  }
  const query = url.searchParams
  let stateStr = query.get('state') || ('' as string)
  const state: GithubState | null = safeJsoncParse(decodeURIComponent(stateStr))
  // const userId = session?.user?.id
  let afterInstallUrl = state?.next

  if (!afterInstallUrl) {
    return new Response('Missing `next` state param callback', {
      status: 400,
    })
  }

  console.log(JSON.stringify(state, null, 2))

  if (!state) {
    return new Response('Missing state', { status: 400 })
  }
  const code = (query.get('code') as string) || ''

  let token
  if (code) {
    console.log('getting oauth token')
    const oauthApp = getGithubApp()
    const tokenRes = await oauthApp.oauth.createToken({
      code,
      state: stateStr,
      redirectUrl: new URL(url.pathname!, env.PUBLIC_URL).href,
    })
    // console.log('createToken', JSON.stringify(tokenRes, null, 2))
    token = tokenRes.authentication.token
  }

  const installationId = Number(query.get('installation_id') || '')

  if (!installationId) {
    return new Response('Missing installation_id', { status: 400 })
    // return res.status(400).json({ error: 'Missing installation_id' })
  }
  const octokit = await getOctokit({ installationId })
  const [installation] = await Promise.all([
    octokit.request('GET /app/installations/{installation_id}', {
      installation_id: installationId,
    }),
  ])
  const account = installation.data.account

  // console.log('account', account)

  const accountLogin =
    account && 'login' in account
      ? account.login
      : account!.slug.replace(/\//g, '-')

  let accountType: GithubAccountType =
    account && 'type' in account && account.type === 'User'
      ? 'USER'
      : 'ORGANIZATION'

  let members = [] as string[]
  if (accountType === 'ORGANIZATION') {
    const { data: githubMembers } = await octokit.rest.orgs.listMembers({
      org: accountLogin,
    })
    members = githubMembers.map((m) => m.login)
  } else {
    members = [accountLogin]
  }

  const appId = String(installation?.data?.app_id || '')
  let orgId = userId
  const createInstallation: Prisma.GithubInstallationUncheckedCreateInput = {
    installationId,
    // orgId,
    orgs: {
      connectOrCreate: {
        where: {
          installationId_appId_orgId: {
            installationId,
            appId,
            orgId,
          },
        },
        create: {
          orgId,
        },
      },
    },
    accountLogin,
    accountAvatarUrl: installation.data.account?.avatar_url || '',
    oauthToken: token,
    appId,
    accountType,
    memberLogins: members,
  }
  installation.data.id
  await Promise.all([
    prisma.githubInstallation.upsert({
      where: {
        installationId_appId: {
          installationId,
          appId,
        },
      },
      create: createInstallation,
      update: createInstallation,
    }),
    // state.siteId &&
    //     prisma.site.update({
    //         where: {
    //             siteId: await state.siteId,
    //         },
    //         data: {
    //             installationId,
    //         },
    //     }),
  ])

  // Set cookie with GitHub login data
  const data: GithubLoginRequestData = {
    githubAccountLogin: accountLogin,
  }
  const githubDataCookie = cookie.serialize(
    GITHUB_LOGIN_DATA_COOKIE,
    encodeURIComponent(JSON.stringify(data)),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 5, // 5 minutes
      path: '/',
    },
  )

  // Redirect to the next URL from state
  let redirectUrl = new URL(afterInstallUrl, env.PUBLIC_URL)

  const response = redirect(redirectUrl.toString())
  response.headers.set('Set-Cookie', githubDataCookie)
  return response
}
