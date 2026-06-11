/**
 * Data constants for the rajavarman ChatGPT promo video recreation.
 * Separated from components so React Fast Refresh works.
 */

export const FEATURE_CARDS = [
  {
    label: 'Language Output',
    value: '10K',
    unit: '/Day',
    subtitle: 'Tokens Used',
    subtitleRight: '8K Day Limit',
    color: '#e85d5d',
    bgGradient: 'linear-gradient(135deg, #d4614a 0%, #e8a080 100%)',
    hasSlider: true,
  },
  {
    label: '24% Complete',
    value: '24',
    unit: '/100',
    subtitle: '',
    color: '#e83a3a',
    bgGradient: 'linear-gradient(135deg, #1a0a0a 0%, #2a0e0e 100%)',
    hasGauge: true,
  },
  {
    label: 'Context Window',
    value: '3,200',
    unit: '',
    subtitle: 'Max 8k',
    color: '#34d399',
    bgGradient: 'linear-gradient(135deg, #0e4a3a 0%, #60c0a0 100%)',
    hasBars: true,
  },
  {
    label: 'Personality Profile',
    value: '',
    unit: '',
    subtitle: 'AI Assistant',
    color: '#a3e635',
    bgGradient: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)',
    hasLogo: true,
  },
] as const

export const THINKING_CARD_COLORS = [
  { bg: '#e8e050', accent: '#c02020', label: 'yellow' },
  { bg: '#0a6040', accent: '#34d399', label: 'green' },
  { bg: '#0a1929', accent: '#a3e635', label: 'navy' },
  { bg: '#8b1a1a', accent: '#f87171', label: 'red' },
  { bg: '#2a1040', accent: '#c084fc', label: 'purple' },
] as const

export const PHONE_SCREENS = [
  'fitness',
  'photos',
  'homescreen',
] as const
