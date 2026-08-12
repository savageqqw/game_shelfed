import { withErrors } from './_utils/response.js'
import { verifyToken } from './_utils/auth.js'

// STEAM-LINK-REWRITE-v2

function siteOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

export default withErrors(async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405
    return res.end('Method not allowed')
  }

  const origin = siteOrigin(req)

  // Linking Steam to an already-logged-in account: the session token travels
  // through Steam's redirect as a query param so the callback can identify
  // which existing user is asking to link, instead of logging in as someone new.
  const rawLinkToken = req.query?.link_token ? String(req.query.link_token) : null

  console.log('[steam-start] invoked', { hasLinkToken: !!rawLinkToken })

  if (rawLinkToken) {
    const linkedUser = verifyToken(rawLinkToken)
    if (!linkedUser) {
      // Fail here, BEFORE sending the person to Steam at all -- no point
      // making them log in there just to bounce back to an error.
      console.error('[steam-start] link_token failed to verify -- aborting before Steam redirect')
      res.statusCode = 302
      res.setHeader('Location', `${origin}/account?steamError=session_expired`)
      return res.end()
    }
    console.log('[steam-start] link_token verified for user', linkedUser.id)
  }

  let returnTo = `${origin}/api/auth-steam-callback`
  if (rawLinkToken) returnTo += `?link_token=${encodeURIComponent(rawLinkToken)}`

  const params = new URLSearchParams({
    'openid.ns': 'http://specs.openid.net/auth/2.0',
    'openid.mode': 'checkid_setup',
    'openid.return_to': returnTo,
    'openid.realm': origin,
    'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
    'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
  })

  res.statusCode = 302
  res.setHeader('Location', `https://steamcommunity.com/openid/login?${params.toString()}`)
  res.end()
})
