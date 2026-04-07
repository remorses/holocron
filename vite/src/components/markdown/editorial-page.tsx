'use client'

/**
 * EditorialPage — top-level page shell.
 * CSS grid layout: left TOC sidebar, centre content, optional right aside.
 * Hosts the logo, header links, and tab bar; renders sections with support
 * for per-section and shared `<Aside full>` asides.
 */

const ENABLE_ASSISTANT = true

import React, { Fragment } from 'react'
import { Link } from 'spiceflow/react'
import {
  config as siteConfig,
  resolvedLogo as siteLogo,
  tabs as siteTabs,
  headerLinks as siteHeaderLinks,
  versionItems as siteVersionItems,
  dropdownItems as siteDropdownItems,
} from '../../data.ts'
import { useHolocronData } from '../../router.ts'
import { SideNav } from './side-nav.tsx'
import { TabLink } from './tab-link.tsx'
import { NavSelect, type NavSelectItem } from './nav-select.tsx'
import { Icon } from '../icon.tsx'
import { ThemeToggle } from '../theme-toggle.tsx'
import { Footer, PoweredBy } from './footer.tsx'
import { BannerDismiss } from './banner.tsx'
import { SidebarAssistant } from '../sidebar-assistant.tsx'
import { ChatDrawer } from '../chat-drawer.tsx'
import { MobileBar } from '../mobile-bar.tsx'
import { NavDrawer } from '../nav-drawer.tsx'

export type EditorialSection = {
  content: React.ReactNode
  aside?: React.ReactNode
  fullWidth?: boolean
  /** How many grid rows this section's aside spans on desktop.
   *  1 (default) for per-section asides. For a shared `<Aside full>`, the
   *  aside is attached to the LAST sub-section of its range and the renderer
   *  computes `grid-row: (thisRow - span + 1) / span ${span}` so the aside
   *  cell covers every sub-section row. Inside that tall cell,
   *  `position: sticky` keeps the aside pinned alongside all those rows. */
  asideRowSpan?: number
}

function getSharedAsideStartRow(row: number, span: number) {
  return row - span + 1
}

function sectionStartsSharedAsideAtTop(section: EditorialSection, index: number) {
  if (!section.aside) return false
  const span = section.asideRowSpan ?? 1
  return span > 1 && getSharedAsideStartRow(index + 1, span) === 1
}

/**
 * Top-level page shell.
 *
 * All static site data (logo, site name, tabs, header links) comes from
 * the shared `data.ts` module. Per-request state (active tab href) comes
 * from the Spiceflow loader via `useHolocronData()`. JSX content
 * (sections, hero, children) is still passed as props because it's
 * request-specific pre-rendered server output.
 */
export function EditorialPage({
  sidebar,
  children,
  sections,
  hero,
  bannerContent,
}: {
  sidebar?: React.ReactNode
  children?: React.ReactNode
  /** When provided, renders section rows with aside support instead of flat children */
  sections?: EditorialSection[]
  /** Page-level hero content rendered above the 3-column grid, aligned with center column. */
  hero?: React.ReactNode
  /** Pre-rendered banner JSX (parsed server-side via safe-mdx). */
  bannerContent?: React.ReactNode
}) {
  const { activeTabHref, activeVersionHref, activeDropdownHref } = useHolocronData()
  const logo = siteLogo.light
  const logoLinkHref = siteLogo.href || '/'
  const siteName = siteConfig.name
  const tabs = siteTabs
  const headerLinks = siteHeaderLinks
  const primary = siteConfig.navbar.primary
  const versionItems = siteVersionItems
  const dropdownSelectItems = siteDropdownItems
  const activeTab = activeTabHref
  const hasTabBar = tabs.length > 0
  const banner = siteConfig.banner
  // Sidebar spans exactly the content rows — no wasted implicit rows.
  const sidebarRowSpan = sections ? sections.length : 1
  const pageStartsWithSharedAside = sections?.some(sectionStartsSharedAsideAtTop) ?? false

  return (
    <div
      className='slot-page flex flex-col gap-(--layout-gap) min-h-screen bg-background text-(color:--text-primary) [font-family:var(--font-primary)] antialiased [text-rendering:optimizeLegibility]'
      style={{
        WebkitFontSmoothing: 'antialiased',
        '--banner-height': bannerContent ? '36px' : '0px',
      } as React.CSSProperties}
    >
      {!!bannerContent && (
        <div className='slot-banner flex h-(--banner-height) items-center justify-center gap-2 bg-foreground px-4 text-background text-xs -mb-(--layout-gap)'>
          <div className='flex-1 text-center truncate [&_a]:underline [&_a]:font-medium [&_a]:hover:opacity-80 [&_p]:inline'>
            {bannerContent}
          </div>
          {!!banner?.dismissible && <BannerDismiss content={banner.content} />}
        </div>
      )}

      {/* Header + Tab bar: full-width, sticky below banner */}
      <div className='slot-navbar'>
        {/* Top row: logo + right links */}
        <div className='mx-auto flex items-center justify-between px-(--mobile-padding) py-(--header-padding-y) lg:max-w-(--grid-max-width) lg:px-0'>
          {/* Left side: logo + version/dropdown selects */}
          <div className='flex items-center gap-3'>
            <Link href={logoLinkHref} className='slot-logo no-underline flex items-center shrink-0'>
              <>
                <img
                  src={logo}
                  alt={siteName || 'Logo'}
                  style={{ height: 'var(--logo-height)', width: 'auto' }}
                  className={siteLogo.dark ? 'dark:hidden' : 'dark:invert'}
                />
                {siteLogo.dark && (
                  <img
                    src={siteLogo.dark}
                    alt={siteName || 'Logo'}
                    style={{ height: 'var(--logo-height)', width: 'auto' }}
                    className='hidden dark:block'
                  />
                )}
              </>
            </Link>
            {versionItems.length > 0 && (
              <span className='hidden lg:inline-flex'>
                <NavSelect
                  items={versionItems}
                  activeHref={activeVersionHref}
                  ariaLabel='Select version'
                />
              </span>
            )}
            {dropdownSelectItems.length > 0 && (
              <span className='hidden lg:inline-flex'>
                <NavSelect
                  items={dropdownSelectItems}
                  activeHref={activeDropdownHref}
                  ariaLabel='Select section'
                />
              </span>
            )}
          </div>
          {/* Right side: icon links + CTA + theme toggle — hidden on mobile, shown in nav drawer instead */}
          <div className='hidden lg:flex items-center gap-4'>
            {/* Icon links. Icons are resolved by `<Icon>` — dispatches on
                emoji / URL / lucide name / structured object. When the user
                wrote `{ type: 'github' }` without an explicit icon, the
                normalizer already auto-filled `link.icon = 'github'`, so
                these links are never invisible. Label-only links (no icon
                resolvable) fall back to rendering the label text. */}
            {headerLinks && headerLinks.length > 0 && (
              <div className='flex items-center gap-3'>
                {headerLinks.map((link) => {
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      aria-label={link.label}
                      className='no-underline flex items-center gap-1.5 text-(color:--text-secondary) transition-colors duration-150 hover:text-(color:--text-primary)'
                    >
                      <Icon icon={link.icon} size={16} />
                      {!link.icon && (
                        <span className='text-xs'>{link.label}</span>
                      )}
                    </a>
                  )
                })}
              </div>
            )}
            {/* Primary CTA button. `type: 'github'` / `type: 'button'` drive
                the default label + icon via TYPE_LABELS/TYPE_ICONS in
                normalize-config.ts. Rendered as a compact pill at the right
                of the navbar so users who configure `navbar.primary` see it
                without extra setup. */}
            {!!primary?.href && (
              <a
                href={primary.href}
                target={primary.href.startsWith('http') ? '_blank' : undefined}
                rel={primary.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                aria-label={primary.label}
                className='slot-navbar-primary no-underline inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-(--border-subtle) text-(color:--text-secondary) transition-colors duration-150 hover:text-(color:--text-primary) hover:border-(--text-secondary)'
              >
                <Icon icon={primary.icon} size={14} />
                <span>{primary.label}</span>
              </a>
            )}
            {/* Theme toggle — hidden when appearance.strict is true */}
            {!siteConfig.appearance.strict && <ThemeToggle />}
          </div>
        </div>

        {/* Mobile bar: Ask AI + Menu — shown under logo bar on mobile */}
        <MobileBar />

        {/* Tab row — hidden on mobile, shown in nav drawer instead */}
        {hasTabBar && (
          <div className='slot-tabbar hidden lg:block'>
            <div className='mx-auto flex h-(--tab-bar-height) max-w-full items-stretch gap-6 overflow-x-auto px-(--mobile-padding) lg:max-w-(--grid-max-width) lg:px-0'>
              {tabs.map((tab) => {
                return <TabLink key={tab.href} tab={tab} isActive={tab.href === (activeTab ?? tabs[0]?.href)} />
              })}
            </div>
          </div>
        )}
      </div>

      {/* Hero: rendered above the 3-column grid, using the same column widths
          so hero content aligns with the center content column (col 2). */}
      {!!hero && (
        <div className='mx-auto w-full max-w-full px-(--mobile-padding) lg:grid lg:grid-cols-[var(--grid-toc-width)_var(--grid-content-width)_var(--grid-sidebar-width)] lg:gap-x-(--grid-gap) lg:justify-between lg:max-w-(--grid-max-width) lg:px-0'>
          <div className='lg:col-start-2'>{hero}</div>
        </div>
      )}

      <div className='grid grid-cols-1 gap-y-(--section-gap) w-full max-w-full mx-auto px-(--mobile-padding) lg:grid-cols-[var(--grid-toc-width)_var(--grid-content-width)_var(--grid-sidebar-width)] lg:gap-x-(--grid-gap) lg:justify-between lg:max-w-(--grid-max-width) lg:px-0'>
        {/* TOC sidebar: sticky within its grid cell */}
        <div className='slot-sidebar-left' style={{ gridRow: `1 / span ${sidebarRowSpan}` }}>
          <div
            style={{
              position: 'sticky',
              top: hasTabBar ? 'var(--sticky-top)' : '0px',
              maxHeight: hasTabBar ? 'calc(100vh - var(--sticky-top))' : '100vh',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SideNav />
          </div>
        </div>

        {sections ? (
          /* Flattened sections layout: section wrappers are DIRECT children of
             the page grid. Page grid's `gap-y-(--section-gap)` provides
             rhythm between sections.

             Per-section wrapper: inner subgrid spanning `lg:col-[2/-1]` of
             the page grid. Content at col [1], per-section aside at col [2].
             Sticky scope for per-section asides = this inner wrapper
             (one section's bounds).

             Shared <Aside full> (asideRowSpan > 1): a SEPARATE direct
             page-grid child at `lg:col-[3]` with explicit `grid-row: start /
             span N`. Sticky containing block = multi-row grid area so
             sticky pins across the whole range. Rendered once, placed in
             DOM after the LAST sub-section of its range — on mobile
             (grid-cols-1), auto-placement by DOM order stacks it at the end. */
          <Fragment>
            {sections.map((section, i) => {
              const row = i + 1
              if (section.fullWidth) {
                return (
                  <div
                    key={i}
                    className='flex flex-col gap-(--prose-gap) text-(length:--type-body-size) lg:col-[2/-1]'
                    style={{ gridRow: row }}
                  >
                    {section.content}
                  </div>
                )
              }
              const span = section.asideRowSpan ?? 1
              const isShared = span > 1
              const sharedAsideStartRow = getSharedAsideStartRow(row, span)
              const hasPerSectionAside = Boolean(section.aside) && !isShared
              const hasSharedAside = Boolean(section.aside) && isShared
              const showPerSectionAsideColumn = i === 0 || hasPerSectionAside
              const renderAssistantInPerSectionAside =
                i === 0 && ENABLE_ASSISTANT && !pageStartsWithSharedAside
              const renderAssistantInSharedAside =
                ENABLE_ASSISTANT && sharedAsideStartRow === 1
              const asideClass =
                'slot-aside flex flex-col gap-3 text-(length:--type-toc-size) leading-[1.5]'
              return (
                <Fragment key={i}>
                  {/* Inner per-section wrapper: subgrid, content + per-section aside */}
                  <div
                    className='flex flex-col gap-y-(--prose-gap) lg:grid lg:grid-cols-subgrid lg:col-[2/-1]'
                    style={{ gridRow: row }}
                  >
                    <div className='slot-main flex flex-col gap-(--prose-gap) lg:col-[1] lg:overflow-visible text-(length:--type-body-size)'>
                      {section.content}
                    </div>
                    {/* Aside column: assistant input (first row only) + per-section aside */}
                    {showPerSectionAsideColumn && (
                      <div
                          className={`flex flex-col gap-4 lg:col-[2] lg:sticky lg:top-(--sticky-top) lg:self-start`}
                      >
                        {renderAssistantInPerSectionAside && <SidebarAssistant />}
                        {hasPerSectionAside && (
                          <div className='slot-aside flex flex-col gap-3 text-(length:--type-toc-size) leading-[1.5]'>
                            {section.aside}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Shared aside: single element, direct page-grid child.
                      Desktop: explicit col 3 + row-span (via CSS var read at lg).
                      Mobile: grid-row stays `auto` → auto-placed by DOM order,
                      stacks at end of range without forcing an implicit 2nd
                      column in grid-cols-1. */}
                  {hasSharedAside && (
                    <div
                      className={`${asideClass} lg:col-[3] lg:[grid-row:var(--shared-row)] lg:sticky lg:top-(--sticky-top) lg:self-start lg:max-h-[calc(100vh-var(--header-height))] lg:overflow-y-auto`}
                      style={{ '--shared-row': `${sharedAsideStartRow} / span ${span}` } as React.CSSProperties}
                    >
                      {/* A shared aside that starts on row 1 owns the whole
                          desktop right rail, so the assistant must render
                          inside that sticky stack to avoid overlap. */}
                      {renderAssistantInSharedAside && <SidebarAssistant />}
                      {section.aside}
                    </div>
                  )}
                </Fragment>
              )
            })}
          </Fragment>
        ) : (
          <>
            {/* Flat layout: single article column + optional static sidebar */}
            <div className='slot-main pb-24 lg:col-[2] text-(length:--type-body-size)'>
              <article className='flex flex-col gap-(--prose-gap)'>{children}</article>
            </div>

            <div className='slot-sidebar-right'>
              <div
                style={{
                  position: 'sticky',
                  top: hasTabBar ? 'var(--sticky-top)' : '12px',
                  paddingTop: '4px',
                }}
              >
                {sidebar}
              </div>
            </div>
          </>
        )}

      </div>

      {/* Site footer + branding — mt-auto pushes to bottom on short pages */}
      <div className='mt-auto'>
        <Footer />
        <PoweredBy />
      </div>

      {/* AI assistant drawer — slides in from right when activated */}
      {ENABLE_ASSISTANT && <ChatDrawer />}

      {/* Mobile navigation drawer (lg:hidden) */}
      <NavDrawer />
    </div>
  )
}
