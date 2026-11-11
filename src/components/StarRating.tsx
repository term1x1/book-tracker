interface Props {
  value: number
  onChange?: (value: number) => void
  size?: 'small' | 'large'
}

export default function StarRating({ value, onChange, size = 'small' }: Props) {
  const interactive = Boolean(onChange)
  return (
    <div className={`stars ${size} ${interactive ? 'interactive' : ''}`} role={interactive ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={n <= value ? 'star filled' : 'star'}
          onClick={
            interactive
              ? (e) => {
                  e.stopPropagation()
                  // повторный тап по той же звезде снимает оценку
                  onChange!(n === value ? 0 : n)
                }
              : undefined
          }
        >
          ★
        </span>
      ))}
    </div>
  )
}
