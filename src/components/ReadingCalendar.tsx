import type { ReadingLog } from '../reading-log'
import { IconCalendar } from './Icons'

interface Props {
  log: ReadingLog
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// Уровень «зелёности» по числу страниц за день
function level(pages: number): number {
  if (pages <= 0) return 0
  if (pages < 15) return 1
  if (pages < 40) return 2
  if (pages < 80) return 3
  return 4
}

// Календарь чтения за текущий месяц в духе GitHub:
// кубик на каждый день, зелёный — читали, внутри — число страниц
export default function ReadingCalendar({ log }: Props) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = now.getDate()

  const monthTitle = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  let total = 0
  const cells = []
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${pad(month + 1)}-${pad(d)}`
    const pages = log[key] ?? 0
    total += pages
    const lvl = level(pages)
    cells.push(
      <div
        key={d}
        className={`cal-cell lvl${lvl}${d === today ? ' today' : ''}${d > today ? ' future' : ''}`}
        title={`${d} ${now.toLocaleDateString('ru-RU', { month: 'long' })}: ${pages} стр.`}
      >
        <span className="cal-pages">{pages > 0 ? pages : '–'}</span>
        <span className="cal-day">{d}</span>
      </div>,
    )
  }

  return (
    <section className="reading-cal">
      <h3 className="reading-cal-title">
        <span className="reading-cal-month">
          <IconCalendar size={16} className="cal-title-icon" />
          {monthTitle[0].toUpperCase() + monthTitle.slice(1)}
        </span>
        <span className="reading-cal-total">
          {total > 0 ? `${total.toLocaleString('ru-RU')} стр.` : 'пока 0 стр.'}
        </span>
      </h3>
      <div className="cal-grid">{cells}</div>
    </section>
  )
}
