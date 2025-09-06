// Dynamic theme imports using vite glob
const themeModulesRaw = import.meta.glob('../themes/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
})

// Transform to use theme names as keys instead of file paths
const themeModules: Record<string, string> = Object.entries(themeModulesRaw).reduce(
  (acc, [path, content]) => {
    const match = path.match(/\/([^/]+)\.css$/)
    if (match && match[1]) {
      acc[match[1]] = content as string
    }
    return acc
  },
  {} as Record<string, string>,
)

// Extract theme names
const themeNames = Object.keys(themeModules)

export { themeModules, themeNames }
