'use client'

interface ActivationRingProps {
  score: number // 0 to 1 (e.g., 0.65 = 65%)
  size?: number // diameter in px, default 120
}

function getProgressColor(score: number): string {
  if (score < 0.5) return '#ef4444'
  if (score < 0.8) return '#f59e0b'
  return '#22c55e'
}

export function ActivationRing({ score, size = 120 }: ActivationRingProps) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedScore = Math.min(1, Math.max(0, score))
  const offset = circumference * (1 - clampedScore)
  const percentage = Math.round(clampedScore * 100)
  const color = getProgressColor(clampedScore)
  const center = size / 2

  return (
    <div
      role="img"
      aria-label={`Activation score: ${percentage}%`}
      style={{ width: size, height: size }}
      className="relative inline-flex items-center justify-center"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease',
          }}
        />
      </svg>

      {/* Center label */}
      <span
        className="absolute font-bold text-lg leading-none"
        style={{ color }}
        aria-hidden="true"
      >
        {percentage}%
      </span>
    </div>
  )
}
