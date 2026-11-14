// Свои SVG-значки вместо эмодзи: выглядят одинаково на всех
// устройствах и красятся в цвета приложения через currentColor.

interface IconProps {
  size?: number
  className?: string
}

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  'aria-hidden': true,
})

// 🔖 «Хочу прочитать»
export function IconBookmark({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M7 4.5h10a1 1 0 0 1 1 1V20l-6-3.6L6 20V5.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// 📖 «Читаю»
export function IconBookOpen({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M12 6.5c-1.6-1.4-3.8-2-6.5-2v13c2.7 0 4.9.6 6.5 2 1.6-1.4 3.8-2 6.5-2v-13c-2.7 0-4.9.6-6.5 2Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M12 6.5v13" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  )
}

// ✅ «Прочитано»
export function IconCheck({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="m8.5 12.2 2.4 2.4 4.6-4.9"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// 💬 обсуждение
export function IconChat({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M12 4.5c-4.7 0-8 3-8 6.8 0 2 1 3.8 2.6 5l-.7 3.2 3.4-1.6c.9.2 1.8.4 2.7.4 4.7 0 8-3 8-6.9s-3.3-6.9-8-6.9Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <circle cx="8.8" cy="11.4" r="1" fill="currentColor" />
      <circle cx="12" cy="11.4" r="1" fill="currentColor" />
      <circle cx="15.2" cy="11.4" r="1" fill="currentColor" />
    </svg>
  )
}

// ➤ отправить
export function IconSend({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M4.5 11.2 19 5l-4.6 14.4-3.2-5.6-6.7-2.6Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path d="M11.2 13.8 19 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

// ⭐ очки рейтинга
export function IconStar({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="m12 4 2.3 4.9 5.2.7-3.8 3.7.9 5.3L12 16l-4.6 2.6.9-5.3-3.8-3.7 5.2-.7L12 4Z"
        fill="currentColor"
      />
    </svg>
  )
}

// 👍 лайк
export function IconThumbUp({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M7.5 10.5 11 4.3c1.3 0 2.2 1 2.2 2.2 0 .6-.3 1.7-.6 2.6h4.3c1.1 0 1.9 1 1.7 2.1l-1 5.3a2 2 0 0 1-2 1.6H7.5m0-7.6v7.6m0-7.6H4.6v7.6h2.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// 👎 дизлайк
export function IconThumbDown({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path
        d="M16.5 13.5 13 19.7c-1.3 0-2.2-1-2.2-2.2 0-.6.3-1.7.6-2.6H7.1c-1.1 0-1.9-1-1.7-2.1l1-5.3a2 2 0 0 1 2-1.6h8.1m0 7.6V5.9m0 7.6h2.9V5.9h-2.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export const STATUS_ICONS = {
  want: IconBookmark,
  reading: IconBookOpen,
  read: IconCheck,
} as const
