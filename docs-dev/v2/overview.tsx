import { TabLink } from 'beskar/src/Tabs'
import { HomeIcon, ChartBarIcon } from '@heroicons/react/solid'

export const Tabs = () => {
    const base = `/v2`

    return (
        <>
            <TabLink
                key='overview'
                aria-label='go to overview'
                href={base}
                icon={<HomeIcon className='icon' />}
            >
                Overview
            </TabLink>
            <TabLink
                key='usage'
                aria-label='go to usage analytics'
                href={base + '/usage'}
                icon={<ChartBarIcon className='icon' />}
            >
                Analytics
            </TabLink>
        </>
    )
}

function Page() {
    return (
        <div className='prose dark:prose-invert max-w-none'>
            <h1>Holocron Editing Architecture Overview</h1>
            
            <p>
                Holocron uses a sophisticated two-way data flow architecture to manage documentation websites. 
                This system allows real-time editing through an AI chat interface while maintaining consistency 
                between in-memory drafts, database storage, and live preview rendering.
            </p>

            <h2>Core Components</h2>

            <h3>1. filesInDraft - In-Memory Draft State</h3>
            <p>
                The central data structure that holds all file modifications during an editing session. 
                Files remain in draft until explicitly synced to the database.
            </p>

            <h3>2. Database Schema</h3>
            <p>
                Persistent storage for pages, media assets, meta files, and configuration using Prisma ORM with PostgreSQL.
            </p>

            <h3>3. Two-Way Sync Flow</h3>
            <ul>
                <li><strong>Files → Database</strong>: Handled by <code>sync.ts</code> for importing and syncing content</li>
                <li><strong>Database → Files</strong>: Handled by <code>getPageContent</code> function for reading content</li>
            </ul>

            <h3>4. FileSystemEmulator</h3>
            <p>
                Virtual file system that provides a unified interface for reading/writing files, abstracting away 
                the difference between draft and persisted content.
            </p>

            <h3>5. State Management</h3>
            <ul>
                <li><strong>Website State</strong>: Main editing state using Zustand</li>
                <li><strong>Docs State</strong>: Preview website state, synchronized via iframe postMessage</li>
            </ul>

            <h2>Key Flows</h2>

            <h3>Editing Flow</h3>
            <ol>
                <li>User interacts with AI chat to request changes</li>
                <li>AI uses tools (strReplaceEditor) to modify files</li>
                <li>Changes are stored in <code>filesInDraft</code> (in-memory)</li>
                <li>Preview updates immediately showing draft changes</li>
                <li>Database is updated when chat completes</li>
            </ol>

            <h3>Preview Flow</h3>
            <ol>
                <li>Docs website reads from both database and <code>filesInDraft</code></li>
                <li>FileSystemEmulator provides unified access</li>
                <li>Monaco editor and markdown preview show live updates</li>
                <li>Changes sync back to parent via postMessage</li>
            </ol>

            <h3>Persistence Flow</h3>
            <ol>
                <li>Chat messages and <code>filesInDraft</code> are saved to database when chat ends</li>
                <li>GitHub sync can push changes to repository</li>
                <li>Search API indexes content for full-text search</li>
            </ol>

            <h2>Architecture Advantages</h2>
            <ul>
                <li><strong>Real-time Preview</strong>: Changes appear instantly without database writes</li>
                <li><strong>Atomic Sessions</strong>: All changes in a chat are grouped together</li>
                <li><strong>Rollback Capability</strong>: Draft changes can be discarded</li>
                <li><strong>Collaborative Editing</strong>: Multiple tools can modify files concurrently</li>
                <li><strong>Version Control Ready</strong>: Changes can be pushed to GitHub as commits</li>
            </ul>

            <h2>Key Challenges</h2>
            <ul>
                <li><strong>State Synchronization</strong>: Keeping website and docs-website in sync</li>
                <li><strong>Debounced Updates</strong>: Database updates only happen at chat completion</li>
                <li><strong>Complex State Passing</strong>: filesInDraft must be passed through multiple layers</li>
                <li><strong>Tool Coordination</strong>: Multiple AI tools need consistent file access</li>
            </ul>

            <h2>Next Steps</h2>
            <p>See the detailed documentation for each component:</p>
            <ul>
                <li><a href="./files-in-draft">filesInDraft Structure</a></li>
                <li><a href="./database-schema">Database Schema</a></li>
                <li><a href="./sync-flow">Sync Flow</a></li>
                <li><a href="./file-system-emulator">File System Emulator</a></li>
                <li><a href="./state-management">State Management</a></li>
                <li><a href="./chat-persistence">Chat Persistence</a></li>
            </ul>
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
