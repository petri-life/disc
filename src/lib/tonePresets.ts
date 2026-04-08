export interface TonePreset {
  min: number
  max: number
  title: string
  label: string
  description: string
  storyTone: string
}

export const tonePresets: TonePreset[] = [
  {
    min: 0, max: 20,
    title: 'Wildly inventive',
    label: 'Mostly creative',
    description: 'Optimistic, idea-forward, generous about edge-case possibilities.',
    storyTone: 'creative sprint',
  },
  {
    min: 21, max: 40,
    title: 'Hopeful builder mode',
    label: 'Creative leaning',
    description: 'A constructive crowd surfacing adjacent features, use cases, and upside.',
    storyTone: 'creative leaning',
  },
  {
    min: 41, max: 60,
    title: 'Balanced frontier',
    label: 'Creative + skeptical',
    description: 'Enough optimism to surface breakout ideas, enough friction to expose weak spots.',
    storyTone: 'balanced frontier',
  },
  {
    min: 61, max: 80,
    title: 'Investor diligence',
    label: 'Skeptical leaning',
    description: 'The thread starts pressing on retention, moats, GTM, and why now.',
    storyTone: 'skeptical leaning',
  },
  {
    min: 81, max: 100,
    title: 'Full contact internet',
    label: 'Adversarial heavy',
    description: 'Sharper criticism, stronger rebuttals, and less patience for hand-wavy claims.',
    storyTone: 'adversarial heavy',
  },
]

export function getTonePreset(value: number): TonePreset {
  return tonePresets.find(p => value >= p.min && value <= p.max) ?? tonePresets[2]
}

export function getSentimentColor(value: number): { color: string; shadow: string } {
  const hue = 165 - value * 1.42
  return {
    color: `hsl(${hue} 88% 56%)`,
    shadow: `hsl(${hue} 88% 56% / 0.16)`,
  }
}
