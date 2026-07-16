import 'server-only'

import { ADMIN_USER_IDS, ADMIN_USERS } from '@/configs/env-flags'

// An identity is an admin when its user id is in ADMIN_USER_IDS (the reliable
// key), or its username/email/email-local-part is in ADMIN_USERS.
export function isAdminUser(user: {
  id: string
  name: string | null
  email: string | null
}): boolean {
  if (user.id && ADMIN_USER_IDS.includes(user.id.toLowerCase())) {
    return true
  }
  const candidates: string[] = []
  if (user.name) candidates.push(user.name)
  if (user.email) {
    candidates.push(user.email)
    const localPart = user.email.split('@')[0]
    if (localPart) candidates.push(localPart)
  }
  return candidates.some((value) => ADMIN_USERS.includes(value.toLowerCase()))
}
