// Re-export Spiceflow's static middleware through Holocron so Spiceflow's
// virtual production entry can resolve it from the wrapper package context.
export { serveStatic } from 'spiceflow'
