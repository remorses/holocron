
// Dynamic theme imports using vite glob
const themeModules = import.meta.glob('../themes/*.css', {
    query: '?raw',
    import: 'default',
    eager: true,
})

// Extract theme names from file paths
const themeNames = Object.keys(themeModules)
    .map((path) => {
        const match = path.match(/\/([^/]+)\.css$/)
        return match ? match[1] : ''
    })
    .filter(Boolean)

export { themeModules, themeNames }
