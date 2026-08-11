import { withErrors } from './_utils/response.js'
import { verifyToken } from './_utils/auth.js'

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
  const linkToken = req.query?.link_token
  const linkedUser = linkToken ? verifyToken(String(linkToken)) : null

  let returnTo = `${origin}/api/auth-steam-callback`
  if (linkedUser) returnTo += `?link_token=${encodeURIComponent(String(linkToken))}`

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
