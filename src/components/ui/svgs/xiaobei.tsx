import type { SVGProps } from 'react'

export function XiaobeiLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="小北"
    >
      <rect width="24" height="24" rx="4" fill="#1A6AFF" />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fill="white"
        fontSize="10"
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
        letterSpacing="-0.5"
      >
        小北
      </text>
    </svg>
  )
}
