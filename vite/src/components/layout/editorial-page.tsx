'use client'

/**
 * EditorialPage — top-level page shell.
 * CSS grid layout: left TOC sidebar, centre content, optional right aside.
 * Hosts the logo, header links, and tab bar; renders sections with support
 * for per-section and shared `<Aside full>` asides.
 */



import React, { Fragment } from 'react'
import { Link } from 'spiceflow/react'
import { useHolocronData } from '../../router.ts'
import {
  buildDropdownItems,
  buildHeaderLinks,
  buildTabItems,
  buildVersionItems,
  getResolvedLogo,
} from '../../site-data.ts'
import { SideNav } from './side-nav.tsx'
import { TabLink } from './tab-link.tsx'
import { NavSelect, type NavSelectItem } from './nav-select.tsx'
import { Icon } from '../icon.tsx'
import { ThemeToggle } from '../theme-toggle.tsx'
import { Footer, Logo, PoweredBy } from './footer.tsx'
import { BannerDismiss } from './banner-dismiss.tsx'
import { ChatDrawer } from '../chat-drawer.tsx'
import { MobileBar } from '../mobile-bar.tsx'
import { NavDrawer } from '../nav-drawer.tsx'
import {
  DEFAULT_SIDEBAR_WIDTH,
  buildGridTokenStyle,
} from '../../lib/sidebar-widths.ts'
import type { HolocronCSSProperties } from '../../lib/css-vars.ts'
import { GridLinesFrame, TabBarDots, NavbarLines, AboveBottomDots } from './grid-lines.tsx'


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

function ContentFooter() {
  return (
    <div className='bleed'>
      <Footer />
      <PoweredBy />
    </div>
  )
}

/**
 * Top-level page shell.
 *
 * Canonical site data and per-request state both come from the Spiceflow root
 * loader via `useHolocronData()`. JSX content
 * (sections, above, children) is still passed as props because it's
 * request-specific pre-rendered server output.
 */
export function EditorialPage({
  sidebar,
  children,
  sections,
  above,
  bannerContent,
  sidebarWidth,
  gridGap,
}: {
  sidebar?: React.ReactNode
  children?: React.ReactNode
  /** When provided, renders section rows with aside support instead of flat children */
  sections?: EditorialSection[]
  /** Page-level content rendered above the 3-column grid, aligned with center column. */
  above?: React.ReactNode
  /** Pre-rendered banner JSX (parsed server-side via safe-mdx). */
  bannerContent?: React.ReactNode
  /** Right-sidebar width in px. When larger than the default, the
   *  page-level grid-max-width is bumped so the grid can actually widen
   *  to accommodate it. When undefined, the default sidebar width is
   *  used (same as the TOC column width). */
  sidebarWidth?: number
  /** Optional page-level grid gap from frontmatter. */
  gridGap?: number
}) {
  const { site, activeTabHref, activeVersionHref, activeDropdownHref } = useHolocronData()
  const siteConfig = site.config
  const enableAssistant = siteConfig.assistant.enabled
  const siteLogo = getResolvedLogo(site)
  const siteTabs = buildTabItems(site)
  const siteHeaderLinks = buildHeaderLinks(site)
  const siteVersionItems = buildVersionItems(site)
  const siteDropdownItems = buildDropdownItems(site)
  const logoLinkHref = siteLogo.href || '/'
  const tabs = siteTabs
  const headerLinks = siteHeaderLinks
  const primary = siteConfig.navbar.primary
  const versionItems = siteVersionItems
  const dropdownSelectItems = siteDropdownItems
  const activeTab = activeTabHref
  const hasTabBar = tabs.length > 0
  const banner = siteConfig.banner
  const decorativeLines = siteConfig.decorativeLines
  // Grid geometry CSS vars are injected here from the single source of
  // truth in `lib/sidebar-widths.ts`. `globals.css` intentionally does
  // NOT declare `--grid-*` defaults — everything flows from this one
  // object so there's only one place to edit. `buildGridTokenStyle`
  // also bumps `--grid-max-width` when the right sidebar is wider than
  // the default (e.g. pages with RequestExample / ResponseExample).
  const pageStyle: HolocronCSSProperties = {
    WebkitFontSmoothing: 'antialiased',
    '--banner-height': bannerContent ? '36px' : '0px',
    '--grid-line-style': decorativeLines === 'none' ? 'none' : decorativeLines === 'dashed' ? 'dashed' : 'solid',
    ...buildGridTokenStyle(sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH, gridGap),
  }

  return (
    <div
      className='slot-page flex flex-col gap-(--layout-gap) min-h-screen bg-background text-foreground [font-family:var(--font-sans)] antialiased [text-rendering:optimizeLegibility]'
      style={pageStyle}
    >
      {!!bannerContent && (
        <div className='slot-banner flex h-(--banner-height) items-center justify-center gap-2 bg-foreground px-4 text-background text-xs -mb-(--layout-gap)'>
          <div className='flex-1 min-w-0 truncate text-center'>
            {bannerContent}
          </div>
          {!!banner?.dismissible && <BannerDismiss content={banner.content} />}
        </div>
      )}

      {/* Header + Tab bar: full-width, sticky below banner */}
      <div className='slot-navbar relative'>
        <NavbarLines mode={decorativeLines} />
        {/* Top row: logo + right links */}
        <div className='mx-auto flex items-center justify-between px-(--mobile-padding) py-(--header-padding-y) lg:max-w-(--grid-max-width) lg:px-0'>
          {/* Left side: logo + version/dropdown selects */}
          <div className='flex items-center gap-3'>
            <Link href={logoLinkHref} className='slot-logo no-underline flex items-center shrink-0'>
              <Logo className='' style={{ height: 'var(--logo-height)' }} />
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
                    <Link
                      key={link.href}
                      href={link.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      aria-label={link.label}
                      className='no-underline flex items-center gap-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground'
                    >
                      <Icon icon={link.icon} size={16} />
                      {!link.icon && (
                        <span className='text-xs'>{link.label}</span>
                      )}
                    </Link>
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
              <Link
                href={primary.href}
                target={primary.href.startsWith('http') ? '_blank' : undefined}
                rel={primary.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                aria-label={primary.label}
                className='slot-navbar-primary no-underline inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border-subtle text-muted-foreground transition-colors duration-150 hover:text-foreground hover:border-muted-foreground'
              >
                <Icon icon={primary.icon} size={14} />
                <span>{primary.label}</span>
              </Link>
            )}
            {/* Theme toggle — hidden when appearance.strict is true */}
            {!siteConfig.appearance.strict && <ThemeToggle />}
          </div>
        </div>

        {/* Mobile bar: Ask AI + Menu — shown under logo bar on mobile */}
        <MobileBar enableAssistant={enableAssistant} />

        {/* Tab row — hidden on mobile, shown in nav drawer instead */}
        {hasTabBar ? (
          <div className='slot-tabbar relative hidden lg:block'>
            <div className='mx-auto flex h-(--tab-bar-height) max-w-full items-stretch gap-6 overflow-x-auto px-(--mobile-padding) text-sm lg:max-w-(--grid-max-width) lg:px-0'>
              {tabs.map((tab) => {
                return <TabLink key={tab.href} tab={tab} isActive={tab.href === (activeTab ?? tabs[0]?.href)} />
              })}
            </div>
            {/* Dots on tab-bar border, aligned with outer vertical lines.
                Positioned on the full-width slot-tabbar so overflow-x on
                the inner scrollable container doesn't clip them. */}
            <TabBarDots mode={decorativeLines} />
          </div>
        ) : decorativeLines !== 'none' ? (
          /* No tabs — render a simple horizontal separator line with dots
             so the decorative frame still has a top boundary. */
          <div className='slot-tabbar relative hidden lg:block' style={{ borderTop: 'none' }}>
            <TabBarDots mode={decorativeLines} />
          </div>
        ) : null}
      </div>

      {/* Outer decorative frame wrapper — relative so GridLinesFrame lines
           position against the max-width boundary. Vertical lines are offset
           outside by --grid-line-offset. Wraps both "above" and the 3-column
           grid so the vertical lines span the full content height.
           Negative top margin closes the flex gap so the vertical lines
           connect seamlessly to the tab-bar border; inner pt restores the
           visual spacing for content. */}
      <div className='relative grow w-full max-w-full mx-auto lg:max-w-(--grid-max-width) lg:-mt-(--layout-gap) lg:pt-(--layout-gap) overflow-y-clip'>
        <GridLinesFrame mode={decorativeLines} />

        {/* Above: rendered above the 3-column grid, using the same column widths
            so above content aligns with the center content column (col 2). */}
        {!!above && (
          <div className='relative mx-auto w-full max-w-full px-(--mobile-padding) lg:grid lg:grid-cols-[var(--grid-nav-width)_var(--grid-content-width)_var(--grid-sidebar-width)] lg:gap-x-(--grid-gap) lg:justify-between lg:px-0'>
            <div className='lg:col-start-2'>{above}</div>
            <AboveBottomDots mode={decorativeLines} />
          </div>
        )}

        <div className='grid grid-cols-1 w-full max-w-full mx-auto px-(--mobile-padding) lg:items-start lg:grid-cols-[var(--grid-nav-width)_var(--grid-content-width)_var(--grid-sidebar-width)] lg:gap-x-(--grid-gap) lg:justify-between lg:px-0'>
        {/* TOC sidebar: sticky in its own outer grid column so section rows
            below are sized only by the content/right-rail subgrid. */}
        <div className='slot-sidebar-left shrink-0 lg:self-stretch'>
          <div
            style={{
              position: 'sticky',
              top: hasTabBar ? 'var(--sticky-top)' : 'calc(var(--header-row-height) + var(--layout-gap))',
              maxHeight: hasTabBar ? 'calc(100vh - var(--sticky-top) - var(--layout-gap))' : 'calc(100vh - var(--header-row-height) - var(--layout-gap) - var(--layout-gap))',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SideNav />
          </div>
        </div>

        <div
          className='grid grid-cols-1 gap-y-(--section-gap) lg:col-[2/-1] lg:grid-cols-subgrid lg:self-stretch'
          style={sections ? {
            /* N auto rows for sections + 1fr spacer + auto footer → pushes footer to bottom */
            gridTemplateRows: `repeat(${sections.length}, auto) 1fr auto`,
          } : undefined}
        >
          {sections ? (
            /* Flattened sections layout: section wrappers are direct children
               of the inner content grid only. The left TOC lives in the outer
               column layout and no longer participates in section row sizing.

               Per-section wrapper: inner subgrid spanning both inherited cols
               of the content grid. Content at col [1], per-section aside at
               col [2]. Sticky scope for per-section asides = this inner
               wrapper (one section's bounds).

               Shared <Aside full> (asideRowSpan > 1): a separate direct child
               of the content grid at `lg:col-[2]` with explicit `grid-row:
               start / span N`. Sticky containing block = multi-row grid area
               so sticky pins across the whole range. Rendered once, placed in
               DOM after the LAST sub-section of its range — on mobile
               (grid-cols-1), auto-placement by DOM order stacks it at the end. */
            <Fragment>
              {sections.map((section, i) => {
                const row = i + 1
                if (section.fullWidth) {
                  return (
                    <div
                      key={i}
                      className='flex flex-col gap-(--prose-gap) text-(length:--type-body-size) lg:col-[1/-1]'
                      style={{ gridRow: row }}
                    >
                      {section.content}
                    </div>
                  )
                }
                const span = section.asideRowSpan ?? 1
                const isShared = span > 1
                const sharedAsideStartRow = row - span + 1
                const hasPerSectionAside = Boolean(section.aside) && !isShared
                const hasSharedAside = Boolean(section.aside) && isShared
                
                const asideClass =
                  'slot-aside flex flex-col gap-3 text-(length:--type-small-size) leading-[1.5]'
                const sharedAsideStyle: HolocronCSSProperties = {
                  '--shared-row': `${sharedAsideStartRow} / span ${span}`,
                }
                return (
                  <Fragment key={i}>
                    {/* Inner per-section wrapper: subgrid, content + per-section aside */}
                    <div
                      className='flex flex-col gap-y-(--prose-gap) lg:grid lg:grid-cols-subgrid lg:col-[1/-1]'
                      style={{ gridRow: row }}
                    >
                      <div className='slot-main flex flex-col gap-(--prose-gap) lg:col-[1] lg:overflow-visible text-(length:--type-body-size)'>
                        {section.content}
                      </div>
                      {/* Aside column: per-section aside */}
                      {hasPerSectionAside && (
                        <div
                            className={`slot-aside flex flex-col gap-3 text-(length:--type-small-size) leading-[1.5] lg:col-[2] lg:sticky lg:top-(--sticky-top) lg:self-start`}
                        >
                          {section.aside}
                        </div>
                      )}
                    </div>
                    {/* Shared aside: single element, direct content-grid child.
                        Desktop: explicit col 2 + row-span (via CSS var read at lg).
                        Mobile: grid-row stays `auto` → auto-placed by DOM order,
                        stacks at end of range without forcing an implicit 2nd
                        column in grid-cols-1. */}
                    {hasSharedAside && (
                      <div
                        className={`${asideClass} lg:col-[2] lg:[grid-row:var(--shared-row)] lg:sticky lg:top-(--sticky-top) lg:self-start lg:max-h-[calc(100vh-var(--header-height))] lg:overflow-y-auto`}
                        style={sharedAsideStyle}
                      >
                        {section.aside}
                      </div>
                    )}
                  </Fragment>
                )
              })}
              {/* Spacer row: 1fr track pushes footer to bottom when grid stretches */}
              <div style={{ gridRow: sections.length + 1 }} className='lg:col-[1]' />
              <div
                className='slot-main lg:col-[1]'
                style={{ gridRow: sections.length + 2 }}
              >
                <ContentFooter />
              </div>
            </Fragment>
          ) : (
            <>
              {/* Flat layout: single article column + optional static sidebar */}
              <div className='slot-main flex flex-col gap-(--section-gap) lg:col-[1] text-(length:--type-body-size) grow'>
                <article className='flex flex-col gap-(--prose-gap)'>
                  {children}
                </article>
                <div className='grow' />
                <ContentFooter />
              </div>

              <div className='slot-sidebar-right lg:!col-[2] lg:self-stretch'>
                <div
                  style={{
                    position: 'sticky',
                    top: hasTabBar ? 'var(--sticky-top)' : 'calc(var(--header-row-height) + var(--layout-gap))',
                    paddingTop: '4px',
                  }}
                >
                  {sidebar}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </div>

      {/* AI assistant drawer — slides in from right when activated */}
      {enableAssistant && <ChatDrawer />}

      {/* Mobile navigation drawer (lg:hidden) */}
      <NavDrawer />
    </div>
  )
}
