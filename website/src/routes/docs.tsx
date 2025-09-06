import { redirect } from 'react-router'
import { WEBSITE_DOMAIN } from 'docs-website/src/lib/env'

export function loader() {
  throw redirect(`https://docs.${WEBSITE_DOMAIN}/`)
}
