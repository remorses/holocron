'skip ssr'

import { maxWidthWithPx, useColorMode } from 'beskar/landing'
import Widgets from '@holocron.so/analytics/src/components/Widgets'
import { Tabs } from './overview'

function Page() {
    const { isDark } = useColorMode()
    const domain = 'holocron-ysx261dl.localhost'
    const namespace = '01K9TCKT3NYJJQX4APFNJCBB58'

    return (
        <div className='flex relative justify-center pt-8'>
            <div
                style={{ maxWidth: maxWidthWithPx() }}
                className='flex grow flex-col items-stretch'
            >
                <Widgets
                    domain={domain}
                    namespace={namespace}
                    isDark={isDark}
                    apiEndpoint={'/api/analytics-data'}
                />
            </div>
        </div>
    )
}

Page.Tabs = Tabs

Page.fullWidth = true

export default Page

export const getServerSideProps = async () => {
    return {
        props: {},
    }
}
