export function getCacheTagForPage({
  branchId,
  slug,
  locale,
}: {
  branchId: string
  slug: string
  locale?: string
}): string {
  const localePrefix = locale ? `:locale:${locale}` : ''
  return `page:${branchId}:${slug}${localePrefix}`
}

export function getCacheTagForMediaAsset({ branchId, slug }: { branchId: string; slug: string }): string {
  return `mediaAsset:${branchId}:${slug}`
}
