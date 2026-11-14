-- Убираем парные записи дружбы (A→B и B→A) от старой версии:
-- оставляем одну строку на пару
DELETE FROM friends
WHERE user_id > friend_id
  AND EXISTS (
    SELECT 1 FROM friends f2
    WHERE f2.user_id = friends.friend_id
      AND f2.friend_id = friends.user_id
  );
