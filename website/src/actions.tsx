// Server actions for the holocron.so website.
// Extracted into a dedicated file so dashboard.tsx and server.tsx stay
// focused on route definitions and rendering.
'use server'

import { getActionRequest, parseFormData, redirect } from 'spiceflow'
import { router } from 'spiceflow/react'
import { z } from 'zod'
import { getAuth, requireSession } from './db.ts'

const deviceUserCodeSchema = z.object({ userCode: z.string().min(1) })

// ── Device flow actions (used by /device page) ──────────────────────

export async function approveDevice(formData: FormData) {
  const actionRequest = getActionRequest()
  await requireSession(actionRequest)
  const { userCode } = parseFormData(deviceUserCodeSchema, formData)
  const auth = getAuth()
  await auth.api.deviceApprove({ body: { userCode }, headers: actionRequest.headers })
  throw redirect(router.href('/device', { user_code: userCode, status: 'approved' }))
}

export async function denyDevice(formData: FormData) {
  const actionRequest = getActionRequest()
  await requireSession(actionRequest)
  const { userCode } = parseFormData(deviceUserCodeSchema, formData)
  const auth = getAuth()
  await auth.api.deviceDeny({ body: { userCode }, headers: actionRequest.headers })
  throw redirect(router.href('/device', { user_code: userCode, status: 'denied' }))
}
