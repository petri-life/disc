import { useCallback } from 'react'
import { getTonePreset, getSentimentColor } from '../lib/tonePresets'

interface Props {
  value: number
  onChange: (value: number) => void
}

export function ToneSlider({ value, onChange }: Props) {
  const preset = getTonePreset(value)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value)
      onChange(v)
      const { color, shadow } = getSentimentColor(v)
      document.documentElement.style.setProperty('--sentiment-light', color)
      document.documentElement.style.setProperty('--sentiment-light-shadow', shadow)
    },
    [onChange],
  )

  return (
    <div className="tone-card">
      <div className="tone-header">
        <p className="section-label">Sentiment mix</p>
      </div>
      <label className="slider-wrap">
        <span className="slider-edge">Creative</span>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={handleChange}
          aria-label={`Sentiment: ${preset.label}`}
        />
        <span className="slider-edge">Adversarial</span>
      </label>
    </div>
  )
}
