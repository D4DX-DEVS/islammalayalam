/* Temporary: print the origins Payload trusts for the sign-in cookie. Reads config only. */
import config from '@payload-config'
const c = await config
console.log(JSON.stringify({ serverURL: c.serverURL, csrf: c.csrf, cors: c.cors }))
process.exit(0)
