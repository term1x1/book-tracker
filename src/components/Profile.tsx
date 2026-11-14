import type { Book } from '../types'
import { computePoints, levelFor, myProfile } from '../social'
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
        <div className="profile-points">⭐ {points} очков · 📄 {pagesRead.toLocaleString('ru-RU')} страниц прочитано</div>
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

      <Stats books={books} />
    </div>
  )
}
