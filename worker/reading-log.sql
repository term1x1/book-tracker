-- Дневник чтения по дням (JSON: {"2026-11-15": 42, ...}) — для календаря в профиле
ALTER TABLE users ADD COLUMN reading_log TEXT;
