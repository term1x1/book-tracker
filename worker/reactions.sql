-- Лайки/дизлайки книг. Книга определяется ключом «название|автор»
-- (как в обсуждениях) — оценки глобальные, общие для всех читателей.
-- Одна реакция на пользователя на книгу: 1 (лайк) или -1 (дизлайк).
CREATE TABLE IF NOT EXISTS reactions (
  book_key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (book_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_book ON reactions(book_key);
