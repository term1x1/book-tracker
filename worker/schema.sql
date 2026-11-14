-- Профили пользователей и их библиотеки (общая база для соц-функций)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,          -- Telegram user id
  name TEXT NOT NULL,           -- имя для показа
  username TEXT,                -- @username, может отсутствовать
  photo_url TEXT,               -- аватар из Telegram, может отсутствовать
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,          -- uuid книги из приложения
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  author TEXT,
  status TEXT NOT NULL,         -- want | reading | read
  rating INTEGER,
  categories TEXT,              -- JSON-массив строк
  cover_url TEXT,
  total_pages INTEGER,
  current_page INTEGER,
  added_at TEXT,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_books_user ON books(user_id);
