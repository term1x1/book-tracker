import type { Book } from '../types'

interface Props {
  books: Book[]
}

export default function Stats({ books }: Props) {
  const read = books.filter((b) => b.status === 'read')
  const reading = books.filter((b) => b.status === 'reading')
  const want = books.filter((b) => b.status === 'want')

  const rated = read.filter((b) => b.rating > 0)
  const avgRating = rated.length
    ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1)
    : '—'

  const thisYear = new Date().getFullYear()
  const readThisYear = read.filter(
    (b) => b.finishedAt && new Date(b.finishedAt).getFullYear() === thisYear,
  ).length

  // книги по категориям
  const byCategory = new Map<string, number>()
  for (const b of books) {
    for (const c of b.categories) {
      byCategory.set(c, (byCategory.get(c) ?? 0) + 1)
    }
  }
  const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxCat = topCategories[0]?.[1] ?? 1

  // лучшие книги
  const topBooks = [...read].filter((b) => b.rating >= 4).sort((a, b) => b.rating - a.rating).slice(0, 5)

  return (
    <div className="stats">
      <div className="stat-grid">
        <div className="stat-tile">
          <div className="stat-value">{read.length}</div>
          <div className="stat-label">прочитано</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{readThisYear}</div>
          <div className="stat-label">в {thisYear} году</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{reading.length}</div>
          <div className="stat-label">читаю сейчас</div>
        </div>
        <div className="stat-tile">
          <div className="stat-value">{want.length}</div>
          <div className="stat-label">в планах</div>
        </div>
        <div className="stat-tile wide">
          <div className="stat-value">{avgRating} <span className="stat-star">★</span></div>
          <div className="stat-label">средняя оценка</div>
        </div>
      </div>

      {topCategories.length > 0 && (
        <section className="stat-section">
          <h3>По категориям</h3>
          {topCategories.map(([cat, count]) => (
            <div key={cat} className="bar-row">
              <span className="bar-label">{cat}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(count / maxCat) * 100}%` }} />
              </div>
              <span className="bar-count">{count}</span>
            </div>
          ))}
        </section>
      )}

      {topBooks.length > 0 && (
        <section className="stat-section">
          <h3>Любимые книги</h3>
          {topBooks.map((b) => (
            <div key={b.id} className="top-book">
              <span className="top-book-title">{b.title}</span>
              <span className="top-book-rating">{'★'.repeat(b.rating)}</span>
            </div>
          ))}
        </section>
      )}

      {books.length === 0 && (
        <p className="empty-hint">Добавьте первую книгу, и здесь появится статистика 📊</p>
      )}
    </div>
  )
}
