'use client'

/**
 * EditorialPage — top-level page shell.
 * CSS grid layout: left TOC sidebar, centre content, optional right aside.
 * Hosts the logo, header links, and tab bar; renders sections with support
 * for per-section and shared `<Aside full>` asides.
 */



import React, { Fragment } from 'react'
import { Link } from '../link.tsx'
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
import { Icon, resolveIconColor } from '../icon.tsx'
import { NavTooltip } from '../sidebar-assistant.tsx'
import { ThemeToggle } from '../theme-toggle.tsx'
import { ConfigPanel, ConfigOverrideListener } from '../config-panel.tsx'
import { Footer, Logo } from './footer.tsx'
import { BannerDismiss } from './banner-dismiss.tsx'
import { HolocronChatBridge } from '../holocron-chat-bridge.tsx'
import { MobileBar } from '../mobile-bar.tsx'
import { NavDrawer } from '../nav-drawer.tsx'
import { GitHubStars } from './github-stars.tsx'
import {
  DEFAULT_SIDEBAR_WIDTH,
  buildGridTokenStyle,
} from '../../lib/sidebar-widths.ts'
import { cn, type HolocronCSSProperties } from '../../lib/css-vars.ts'
import { sharedAsideRange } from '../../lib/mdx-sections.ts'
import type { PageMode } from '../../lib/page-frontmatter.ts'
import { GridLinesFrame, TabBarDots, NavbarLines, AboveBottomDots } from './grid-lines.tsx'

function resolveEditorialPageMode(mode: PageMode | undefined): 'default' | 'compact' | 'center' | 'custom' {
  // Four resolved modes:
  // - "default" (+ "wide", "frame"): full editorial layout with left nav,
  //   sections grid, right aside column.
  // - "compact": keeps left nav and removes the optional right aside.
  // - "center": hides left nav, centers content in 2-column grid.
  // - "custom": strips the editorial grid entirely. Only navbar + footer are
  //   rendered; content is a plain full-width container. For landing pages
  //   and custom layouts where the user controls everything.
  if (mode === 'custom') return 'custom'
  if (mode === 'compact') return 'compact'
  if (mode === 'center') return 'center'
  return 'default'
}


export type EditorialSection = {
  content: React.ReactNode
  /** Per-section aside. Sticky only within this section's row. */
  aside?: React.ReactNode
  /** Authored full-span aside. Rendered as its own multi-row grid cell. */
  sharedAside?: React.ReactNode
  fullWidth?: boolean
  /** How many grid rows this section's shared aside spans on desktop.
   *  For a shared `<Aside full>`, the aside is attached to the LAST
   *  sub-section of its range and the renderer computes
   *  `grid-row: (thisRow - span + 1) / span ${span}` so the aside
   *  cell covers every sub-section row. Inside that tall cell,
   *  `position: sticky` keeps the aside pinned alongside all those rows. */
  asideRowSpan?: number
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
  mode,
  maxWidth,
  hideSidebarAssistant = false,
}: {
  sidebar?: React.ReactNode
  children?: React.ReactNode
  /** When provided, renders section rows with aside support instead of flat children */
  sections?: EditorialSection[]
  /** Page-level content rendered above the 3-column grid, spanning the full grid width. */
  above?: React.ReactNode
  /** Pre-rendered banner JSX (parsed server-side via safe-mdx). */
  bannerContent?: React.ReactNode
  /** Right-sidebar width in px. Defaults to the TOC column width. */
  sidebarWidth?: number
  /** Optional page-level grid gap from frontmatter. */
  gridGap?: number
  /** Override the maximum content width. Accepts a number (pixels) or a
   *  CSS string (e.g. "700px", "80%", "60ch"). Used in custom mode to
   *  constrain the content container. */
  maxWidth?: number | string
  /** Mintlify-compatible page mode from MDX frontmatter. */
  mode?: PageMode
  /** Compact mode hides the sidebar Ask AI widget. */
  hideSidebarAssistant?: boolean
}) {
  const { site, currentPageHref, activeTabHref, activeVersionHref, activeDropdownHref, showConfigPanel, githubStars } = useHolocronData()
  const siteConfig = site.config
  const enableAssistant = siteConfig.assistant.enabled
  const floatingAssistant = enableAssistant && siteConfig.assistant.display === 'floating'
  const sidebarAssistantHidden = hideSidebarAssistant || floatingAssistant
  const siteLogo = getResolvedLogo(site)
  const siteTabs = buildTabItems(site, currentPageHref)
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
  const pageMode = resolveEditorialPageMode(mode ?? siteConfig.layout.mode)
  const isCustomMode = pageMode === 'custom'
  const showLeftNav = pageMode === 'default' || pageMode === 'compact'
  const showRightAside = pageMode !== 'compact'
  // In center mode the content + right rail occupy the page width without the
  // left navigation column, so cap the grid width to drop that column's width.
  const centerMaxWidthClass = 'lg:max-w-[calc(var(--grid-max-width)_-_var(--grid-nav-width)_-_var(--grid-gap))]'
  // Above content spans the FULL grid width (left sidebar + content + right
  // sidebar), not just the center column. It's a plain full-width block capped
  // at --grid-max-width (or the reduced center-mode width when the left nav is
  // dropped), mirroring the navbar/tab-bar container.
  const aboveClass = showLeftNav
    ? 'relative mx-auto w-full max-w-full px-(--mobile-padding) lg:max-w-(--grid-max-width) lg:px-0'
    : `relative mx-auto w-full max-w-full px-(--mobile-padding) ${centerMaxWidthClass} lg:px-0`
  const pageGridClass = cn(
    'grid grow grid-cols-1 w-full max-w-full mx-auto px-(--mobile-padding) lg:items-start lg:gap-x-(--grid-gap) lg:justify-between lg:px-0',
    showLeftNav && showRightAside && 'lg:grid-cols-[var(--grid-nav-width)_var(--grid-content-width)_var(--grid-sidebar-width)]',
    showLeftNav && !showRightAside && 'lg:grid-cols-[var(--grid-nav-width)_var(--grid-content-width)]',
    !showLeftNav && 'lg:grid-cols-[var(--grid-content-width)_var(--grid-sidebar-width)]',
    !showLeftNav && centerMaxWidthClass,
  )
  const contentGridClass = showLeftNav
    ? 'grid grid-cols-1 gap-y-(--section-gap) lg:col-[2/-1] lg:grid-cols-subgrid lg:self-stretch'
    : 'grid grid-cols-1 gap-y-(--section-gap) lg:col-[1/-1] lg:grid-cols-subgrid lg:self-stretch'
  // Grid geometry CSS vars are injected here from the single source of
  // truth in `lib/sidebar-widths.ts`. `globals.css` intentionally does
  // NOT declare `--grid-*` defaults — everything flows from this one
  // object so there's only one place to edit. `buildGridTokenStyle`
  // Font size overrides from config.fonts
  const bodyFontSize = siteConfig.fonts?.fontSize
  const headingFontSize = siteConfig.fonts?.heading?.fontSize

  const pageStyle: HolocronCSSProperties = {
    WebkitFontSmoothing: 'antialiased',
    '--banner-height': bannerContent ? '36px' : '0px',
    '--grid-line-style': decorativeLines === 'none' ? 'none' : decorativeLines === 'dashed' ? 'dashed' : 'solid',
    ...(bodyFontSize !== undefined && { '--type-body-size': `${bodyFontSize}px` }),
    ...(headingFontSize !== undefined && {
      '--type-heading-1-size': `${headingFontSize}px`,
      '--type-heading-2-size': `${headingFontSize}px`,
      '--type-heading-3-size': `${headingFontSize}px`,
    }),
    ...buildGridTokenStyle({
      sidebarWidth: sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
      gridGap,
      configLayout: siteConfig.layout,
      compact: pageMode === 'compact',
    }),
  }

  return (
    <div
      className='slot-page flex flex-col gap-(--layout-gap) grow bg-background text-foreground [font-family:var(--font-sans)] antialiased [text-rendering:optimizeLegibility] overflow-x-clip'
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
            <Link href={logoLinkHref} className='slot-logo no-underline flex items-center gap-2 shrink-0'>
              <Logo style={{ height: 'var(--logo-height)' }} />
              {siteLogo.text && (
                <span style={{ fontFamily: 'var(--font-heading, var(--font-body, var(--font-sans)))', fontWeight: 'var(--weight-heading)', fontSize: '22px', letterSpacing: 'var(--ls-prose)', color: 'var(--foreground)' }}>
                  {siteLogo.text}
                </span>
              )}
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
                  const iconOnly = !!link.icon
                  const hasStars = link.type === 'github' && githubStars
                  const linkEl = (
                    <Link
                      key={link.href}
                      href={link.href}
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                      aria-label={link.label}
                      className='no-underline flex items-center gap-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground'
                    >
                      <Icon icon={link.icon} size={16} color={resolveIconColor(link.iconColor)} />
                      {hasStars && <GitHubStars starsPromise={githubStars} href={link.href} />}
                      {!iconOnly && !hasStars && (
                        <span className='text-sm'>{link.label}</span>
                      )}
                    </Link>
                  )
                  return iconOnly ? (
                    <NavTooltip key={link.href} label={link.label} position='below'>{linkEl}</NavTooltip>
                  ) : (
                    linkEl
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
                <Icon icon={primary.icon} size={14} color={resolveIconColor(primary.iconColor)} />
                <span>{primary.label}</span>
                {primary.type === 'github' && githubStars && <GitHubStars starsPromise={githubStars} href={primary.href} />}
              </Link>
            )}
            {/* Theme toggle — hidden when appearance.strict is true */}
            {!siteConfig.appearance.strict && <ThemeToggle />}
          </div>
        </div>

        {/* Mobile bar: Ask AI + Menu — shown under logo bar on mobile */}
        {(showLeftNav || isCustomMode) && <MobileBar enableAssistant={enableAssistant && !sidebarAssistantHidden} />}

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

      {isCustomMode ? (
        /* Custom mode: no editorial grid, no sections, no decorative lines.
           Just a plain full-width container matching navbar max-width so
           users have full control for landing pages and custom layouts.
           When maxWidth is set via frontmatter, the container is narrower
           and centered within the page. */
        <div
          className='relative grow flex flex-col w-full max-w-full mx-auto px-(--mobile-padding) lg:px-0'
          style={{ maxWidth: maxWidth ? (typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth) : 'var(--grid-max-width)' }}
        >
          <div className='flex flex-col gap-(--prose-gap) grow'>
            {children}
          </div>
          <Footer />
        </div>
      ) : (
      /* Outer decorative frame wrapper — relative so GridLinesFrame lines
           position against the max-width boundary. Vertical lines are offset
           outside by --grid-line-offset. Wraps both "above" and the 3-column
           grid so the vertical lines span the full content height.
           Negative top margin closes the flex gap so the vertical lines
           connect seamlessly to the tab-bar border; inner pt restores the
           visual spacing for content. */
      <div className={`relative grow flex flex-col w-full max-w-full mx-auto lg:max-w-(--grid-max-width) lg:-mt-(--layout-gap) ${above ? '' : 'lg:pt-(--layout-gap)'} overflow-y-clip`}>
        <GridLinesFrame mode={decorativeLines} />

        {/* Above: rendered above the 3-column grid, spanning the full grid
            width (left sidebar + content + right sidebar). */}
        {!!above && (
          <div className={aboveClass}>
            {above}
            <AboveBottomDots mode={decorativeLines} />
          </div>
        )}

        <div className={pageGridClass}>
        {/* TOC sidebar: sticky in its own outer grid column so section rows
            below are sized only by the content/right-rail subgrid. */}
        {showLeftNav && (
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
        )}

        <div
          className={contentGridClass}
          style={sections ? {
            /* N auto rows for sections + 1 flexible footer row.
               minmax(max-content, 1fr) ensures the footer row stretches to
               fill remaining height on short pages, with content pinned to
               the bottom via justify-end. Using a single row instead of
               "spacer + footer" avoids an extra gap-y-(--section-gap) gap
               that was pushing the footer below the viewport. */
            gridTemplateRows: `repeat(${sections.length}, auto) minmax(max-content, 1fr)`,
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
                const { start: sharedAsideStartRow, span } = sharedAsideRange(section.asideRowSpan, i)
                const hasPerSectionAside = Boolean(section.aside)
                const hasSharedAside = Boolean(section.sharedAside)
                const stickyBase = hasTabBar
                  ? 'var(--sticky-top)'
                  : 'calc(var(--header-row-height) + var(--layout-gap))'
                const asideClass =
                  'slot-aside flex flex-col text-(length:--type-small-size) leading-[1.5]'
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
                      {hasPerSectionAside && showRightAside && (
                        <div className={`${asideClass} lg:col-[2]`}>
                          {/* w-full: flex-col + self-start would shrink to copy-button min-content. */}
                          <div
                            className='flex w-full flex-col gap-3 lg:sticky lg:overflow-y-auto scrollbar-none [&>*]:shrink-0'
                            style={{
                              top: stickyBase,
                              maxHeight: hasTabBar ? 'calc(100vh - var(--sticky-top))' : 'calc(100vh - var(--header-row-height) - var(--layout-gap))',
                            }}
                          >
                            {section.aside}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Authored full aside: single element, direct content-grid child.
                        Desktop: explicit col 2 + row-span (via CSS var read at lg).
                        Mobile: grid-row stays `auto` → auto-placed by DOM order,
                        stacks at end of range without forcing an implicit 2nd
                        column in grid-cols-1. */}
                     {hasSharedAside && showRightAside && (
                      <div
                        className={`${asideClass} gap-3 lg:col-[2] lg:[grid-row:var(--shared-row)] lg:sticky lg:self-start lg:overflow-y-auto scrollbar-none [&>*]:shrink-0`}
                        style={{
                          ...sharedAsideStyle,
                          top: stickyBase,
                          maxHeight: hasTabBar ? 'calc(100vh - var(--sticky-top))' : 'calc(100vh - var(--header-row-height) - var(--layout-gap))',
                        }}
                      >
                        {section.sharedAside}
                      </div>
                    )}
                  </Fragment>
                )
              })}
              {/* Footer row: minmax(max-content, 1fr) stretches this row to
                  fill remaining height. justify-end pins the footer content
                  to the bottom of that stretched row. */}
              <div
                className='slot-main flex flex-col justify-end lg:col-[1]'
                style={{ gridRow: sections.length + 1 }}
              >
                <Footer />
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
                <Footer />
              </div>

              {showRightAside && <div className='slot-sidebar-right lg:!col-[2] lg:self-stretch'>
                <div
                  style={{
                    position: 'sticky',
                    top: hasTabBar ? 'var(--sticky-top)' : 'calc(var(--header-row-height) + var(--layout-gap))',
                    paddingTop: '4px',
                  }}
                >
                  {sidebar}
                </div>
              </div>}
            </>
          )}
        </div>
      </div>
      </div>
      )}

      {/* AI assistant drawer — slides in from right when activated */}
      {enableAssistant && <HolocronChatBridge />}

      {/* Mobile navigation drawer (lg:hidden) */}
      {(showLeftNav || isCustomMode) && <NavDrawer />}

      {/* Config customization panel — loaded asynchronously when idle.
          Only mounted in dev mode and on preview subdomains. DialKit
          renders its own floating toggle button. */}
      {showConfigPanel && <ConfigPanel config={siteConfig} />}
      <ConfigOverrideListener />
    </div>
  )
}
