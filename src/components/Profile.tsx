import type { Book } from '../types'
import { computePoints, levelFor, myProfile } from '../social'
import { ACHIEVEMENTS, unlockedCount } from '../achievements'
import Stats from './Stats'

interface Props {
  books: Book[]
}

// Страница своего профиля: кто вы, звание, очки и вся статистика
export default function Profile({ books }: Props) {
  const points = computePoints(books)
  const level = levelFor(points)
  const pagesRead = books
    .filter((b) => b.status === 'read')
    .reduce((s, b) => s + (b.totalPages ?? 0), 0)

  return (
    <div className="profile">
      <div className="profile-card">
        {myProfile.photo ? (
          <img className="profile-avatar" src={myProfile.photo} alt="" />
        ) : (
          <div className="profile-avatar profile-avatar-letter">
            {myProfile.name.trim().charAt(0).toUpperCase() || '📖'}
          </div>
        )}
        <h2 className="profile-name">{myProfile.name}</h2>
        {myProfile.username && <div className="profile-username">@{myProfile.username}</div>}
        <div className="profile-level-badge">
          {level.emoji} {level.title}
        </div>
        <div className="profile-points">⭐ {points} очков · {pagesRead.toLocaleString('ru-RU')} страниц прочитано</div>
        {level.next !== null && (
          <div className="level-progress profile-progress">
            <div className="level-progress-bar">
              <div
                className="level-progress-fill"
                style={{
                  width: `${Math.min(100, Math.round(((points - level.min) / (level.next - level.min)) * 100))}%`,
                }}
              />
            </div>
            <span className="level-progress-hint">
              до «{levelFor(level.next).title}» ещё {level.next - points} очков
            </span>
          </div>
        )}
      </div>

      <section className="achievements">
        <h3 className="achievements-title">
          🏅 Достижения
          <span className="achievements-count">{unlockedCount(books)} из {ACHIEVEMENTS.length}</span>
        </h3>
        <div className="achievements-grid">
          {ACHIEVEMENTS.map((a) => {
            const value = a.value(books)
            const unlocked = value >= a.target
            return (
              <div key={a.id} className={unlocked ? 'achievement unlocked' : 'achievement'} title={a.desc}>
                <span className="achievement-emoji">{a.emoji}</span>
                <span className="achievement-name">{a.title}</span>
                <span className="achievement-progress">
                  {unlocked ? '✓' : `${Math.min(value, a.target)}/${a.target}`}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <Stats books={books} />
    </div>
  )
}
