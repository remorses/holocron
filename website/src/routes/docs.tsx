import { redirect } from 'react-router'

export function loader() {
    throw redirect('https://docs.fumabase.com/')
}
