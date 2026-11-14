// Telegram-бот трекера книг: отвечает на /start приветствием
// с кнопкой открытия Mini App. Работает на Cloudflare Workers (бесплатно).

const WELCOME = (name) => `👋 Привет${name ? ', ' + name : ''}!

Это «Мои книги» — твой личный трекер чтения прямо в Telegram.

📚 Веди библиотеку: «Хочу прочитать» → «Читаю» → «Прочитано»
🔍 Добавляй книги за секунды — поиск сам подставит автора и обложку
📖 Отмечай прогресс по страницам
⭐ Ставь оценки и пиши заметки
📊 Смотри статистику: сколько прочитано за год, любимые жанры

Данные хранятся в облаке Telegram и синхронизируются между твоими устройствами. Жми кнопку ниже 👇`

async function tg(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

// Счётчик пользователей в KV: ключи bot:<id> и app:<id>,
// значение {f: первый визит, l: последний визит} (ISO-даты)
async function remember(env, key) {
  try {
    const now = new Date().toISOString()
    const raw = await env.USERS.get(key)
    if (!raw) {
      await env.USERS.put(key, JSON.stringify({ f: now, l: now }))
      return
    }
    // старый формат — просто ISO-строка
    const rec = raw.startsWith('{') ? JSON.parse(raw) : { f: raw, l: raw }
    // пишем не чаще раза в день, чтобы не плодить записи
    if (rec.l.slice(0, 10) !== now.slice(0, 10)) {
      rec.l = now
      await env.USERS.put(key, JSON.stringify(rec))
    }
  } catch {
    // статистика не должна ломать бота
  }
}

async function loadRecords(env, prefix) {
  const keys = []
  let cursor
  do {
    const page = await env.USERS.list({ prefix, cursor })
    keys.push(...page.keys.map((k) => k.name))
    cursor = page.list_complete ? null : page.cursor
  } while (cursor)
  const records = await Promise.all(
    keys.map(async (name) => {
      const raw = await env.USERS.get(name)
      if (!raw) return null
      return raw.startsWith('{') ? JSON.parse(raw) : { f: raw, l: raw }
    }),
  )
  return records.filter(Boolean)
}

function buildStats(appRecords, botRecords) {
  const now = Date.now()
  const day = 86400000
  const activeSince = (records, days) =>
    records.filter((r) => now - Date.parse(r.l) < days * day).length

  // новые пользователи приложения по дням за последние 14 дней
  const byDay = []
  for (let i = 13; i >= 0; i--) {
    const date = new Date(now - i * day).toISOString().slice(0, 10)
    byDay.push({
      date,
      new: appRecords.filter((r) => r.f.slice(0, 10) === date).length,
      active: appRecords.filter((r) => r.l.slice(0, 10) === date).length,
    })
  }

  return {
    app_total: appRecords.length,
    bot_total: botRecords.length,
    app_active_7d: activeSince(appRecords, 7),
    app_active_30d: activeSince(appRecords, 30),
    by_day: byDay,
  }
}

// Страница статистики в стиле приложения
const DASHBOARD = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Статистика · Мои книги</title>
<style>
  :root {
    --bg: #16283f; --page: #0d1a2c; --text: #e8f1fc;
    --hint: #8ba4c4; --accent: #2b7de9; --radius: 14px;
  }
  @media (prefers-color-scheme: light) {
    :root { --bg: #ffffff; --page: #e9f1fc; --text: #13233a; --hint: #64799a; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--page); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 560px; margin: 0 auto; padding: 20px 16px 48px; }
  h1 { font-size: 20px; display: flex; align-items: center; gap: 8px; margin: 4px 0 16px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
  .tile { background: var(--bg); border-radius: var(--radius); padding: 16px; text-align: center; }
  .num { font-size: 30px; font-weight: 700; }
  .lbl { color: var(--hint); font-size: 12.5px; margin-top: 3px; }
  .card { background: var(--bg); border-radius: var(--radius); padding: 16px; margin-bottom: 14px; }
  .card h2 { font-size: 14px; margin: 0 0 14px; color: var(--hint); font-weight: 500; }
  .chart { display: flex; align-items: flex-end; gap: 4px; height: 110px; }
  .col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; }
  .bar { background: var(--accent); border-radius: 4px 4px 0 0; min-height: 2px; opacity: .9; }
  .bar.zero { background: var(--hint); opacity: .18; }
  .dates { display: flex; gap: 4px; margin-top: 6px; }
  .dates span { flex: 1; text-align: center; font-size: 9.5px; color: var(--hint); }
  .muted { color: var(--hint); font-size: 13px; text-align: center; padding: 8px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>📊 Статистика «Мои книги»</h1>
  <div class="grid" id="tiles"><div class="muted">Загрузка…</div></div>
  <div class="card">
    <h2>Новые пользователи приложения · 14 дней</h2>
    <div class="chart" id="chart"></div>
    <div class="dates" id="dates"></div>
  </div>
</div>
<script>
fetch('/stats.json').then(r => r.json()).then(s => {
  const t = (n, l) => '<div class="tile"><div class="num">' + n + '</div><div class="lbl">' + l + '</div></div>';
  document.getElementById('tiles').innerHTML =
    t(s.app_total, 'всего в приложении') +
    t(s.bot_total, 'всего писали боту') +
    t(s.app_active_7d, 'активны за 7 дней') +
    t(s.app_active_30d, 'активны за 30 дней');
  const max = Math.max(1, ...s.by_day.map(d => d.new));
  document.getElementById('chart').innerHTML = s.by_day.map(d =>
    '<div class="col" title="' + d.date + ': +' + d.new + '"><div class="bar' +
    (d.new ? '' : ' zero') + '" style="height:' + Math.round(d.new / max * 100) + '%"></div></div>'
  ).join('');
  document.getElementById('dates').innerHTML = s.by_day.map((d, i) =>
    '<span>' + (i % 2 ? '' : d.date.slice(8) + '.' + d.date.slice(5, 7)) + '</span>'
  ).join('');
}).catch(() => {
  document.getElementById('tiles').innerHTML = '<div class="muted">Не удалось загрузить данные</div>';
});
</script>
</body>
</html>`

// Админ-панель: пароль хранится только в localStorage браузера админа
const ADMIN_HTML = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Админка · Мои книги</title>
<style>
  :root {
    --bg: #16283f; --page: #0d1a2c; --text: #e8f1fc;
    --hint: #8ba4c4; --accent: #2b7de9; --danger: #e05f5f; --radius: 12px;
  }
  @media (prefers-color-scheme: light) {
    :root { --bg: #ffffff; --page: #e9f1fc; --text: #13233a; --hint: #64799a; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--page); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .wrap { max-width: 760px; margin: 0 auto; padding: 20px 14px 60px; }
  h1 { font-size: 20px; margin: 4px 0 16px; }
  .tabs { display: flex; gap: 6px; margin-bottom: 16px; }
  .tabs button {
    flex: 1; padding: 9px; border: none; border-radius: 10px; cursor: pointer;
    background: var(--bg); color: var(--hint); font-weight: 600; font-size: 13.5px;
  }
  .tabs button.on { background: var(--accent); color: #fff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
  .tile { background: var(--bg); border-radius: var(--radius); padding: 14px; text-align: center; }
  .num { font-size: 26px; font-weight: 700; }
  .lbl { color: var(--hint); font-size: 12px; margin-top: 2px; }
  .card { background: var(--bg); border-radius: var(--radius); padding: 12px 14px; margin-bottom: 10px; }
  .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .grow { flex: 1; min-width: 0; }
  .name { font-weight: 600; font-size: 14.5px; }
  .meta { color: var(--hint); font-size: 12px; margin-top: 2px; word-break: break-word; }
  .badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
  .badge.ban { background: rgba(224,95,95,.18); color: var(--danger); }
  button.act {
    border: none; border-radius: 9px; padding: 7px 11px; cursor: pointer;
    font-size: 12px; font-weight: 600; background: rgba(43,125,233,.15); color: var(--accent);
  }
  button.act.danger { background: rgba(224,95,95,.14); color: var(--danger); }
  .login { max-width: 330px; margin: 15vh auto 0; text-align: center; }
  .login input {
    width: 100%; padding: 12px; border-radius: 10px; margin: 12px 0;
    border: 1px solid var(--hint); background: var(--bg); color: var(--text); font-size: 16px;
  }
  .login button.act { width: 100%; padding: 12px; font-size: 14px; background: var(--accent); color: #fff; }
  .muted { color: var(--hint); font-size: 13px; text-align: center; padding: 14px; }
  .muted a { color: var(--accent); }
  .comment-text { font-size: 13.5px; margin-top: 5px; white-space: pre-wrap; word-break: break-word; }
  .err { color: var(--danger); font-size: 13px; min-height: 18px; }
</style>
</head>
<body>
<div class="wrap" id="app"><p class="muted">Загрузка…</p></div>
<script>
const $ = (id) => document.getElementById(id);
const app = $('app');
let KEY = localStorage.getItem('admin_key') || '';
let TAB = 'overview';

const api = (path, opts = {}) =>
  fetch('/api/admin/' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY, ...(opts.headers || {}) },
  }).then((r) => {
    if (r.status === 401) { throw new Error('auth'); }
    return r.json();
  });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

function showLogin(bad) {
  app.innerHTML = '<div class="login"><h1>🔐 Админка «Мои книги»</h1>' +
    '<input id="pw" type="password" placeholder="Пароль администратора">' +
    '<div class="err">' + (bad ? 'Неверный пароль' : '') + '</div>' +
    '<button class="act" id="go">Войти</button></div>';
  const submit = () => { KEY = $('pw').value.trim(); localStorage.setItem('admin_key', KEY); render(); };
  $('go').onclick = submit;
  $('pw').onkeydown = (e) => e.key === 'Enter' && submit();
}

function shell(content) {
  app.innerHTML = '<h1>🛠 Админка «Мои книги»</h1>' +
    '<div class="tabs">' +
    ['overview|Обзор', 'users|Пользователи', 'comments|Отзывы'].map((t) => {
      const [k, l] = t.split('|');
      return '<button class="' + (TAB === k ? 'on' : '') + '" onclick="setTab(\\'' + k + '\\')">' + l + '</button>';
    }).join('') +
    '</div><div id="content">' + content + '</div>';
}

window.setTab = (t) => { TAB = t; render(); };

window.doAction = async (action, id, confirmText) => {
  if (confirmText && !confirm(confirmText)) return;
  try { await api('action', { method: 'POST', body: JSON.stringify({ action, id }) }); render(); }
  catch (e) { e.message === 'auth' ? showLogin(true) : alert('Ошибка'); }
};

async function render() {
  if (!KEY) return showLogin(false);
  try {
    if (TAB === 'overview') {
      const s = await api('overview');
      const t = (n, l) => '<div class="tile"><div class="num">' + n + '</div><div class="lbl">' + l + '</div></div>';
      shell('<div class="grid">' +
        t(s.db.users, 'пользователей') + t(s.db.books, 'книг в базе') +
        t(s.db.comments, 'отзывов') + t(s.db.friendships, 'дружб') +
        t(s.app_active_7d, 'активны 7 дней') + t(s.app_active_30d, 'активны 30 дней') +
        t(s.bot_total, 'писали боту') + t(s.db.banned, 'в бане') +
        '</div><p class="muted">График посещений — на <a href="/stats">/stats</a></p>');
    } else if (TAB === 'users') {
      const { users } = await api('users');
      shell(users.length === 0 ? '<p class="muted">Пусто</p>' : users.map((u) =>
        '<div class="card"><div class="row"><div class="grow">' +
        '<div class="name">' + esc(u.name) + (u.username ? ' <span style="color:var(--hint)">@' + esc(u.username) + '</span>' : '') +
        (u.banned ? ' <span class="badge ban">БАН</span>' : '') + '</div>' +
        '<div class="meta">id ' + esc(u.id) + ' · 📚 ' + u.books_count + ' книг · ✅ ' + u.read_count +
        ' · ⭐ ' + u.points + ' · был(а) ' + fmtDate(u.updated_at) + '</div></div>' +
        '<button class="act" onclick="doAction(\\'' + (u.banned ? 'unban' : 'ban') + '\\',\\'' + esc(u.id) + '\\')">' +
        (u.banned ? 'Разбанить' : 'Забанить') + '</button>' +
        '<button class="act danger" onclick="doAction(\\'delete_user\\',\\'' + esc(u.id) + '\\',\\'Удалить пользователя и все его данные? Это необратимо.\\')">Удалить</button>' +
        '</div></div>').join(''));
    } else {
      const { comments } = await api('comments');
      shell(comments.length === 0 ? '<p class="muted">Отзывов пока нет</p>' : comments.map((c) =>
        '<div class="card"><div class="row"><div class="grow">' +
        '<div class="name">' + esc(c.name ?? 'Читатель') + (c.username ? ' <span style="color:var(--hint)">@' + esc(c.username) + '</span>' : '') + '</div>' +
        '<div class="meta">📖 ' + esc(c.book_key.split('|')[0]) + ' · ' + fmtDate(c.created_at) + '</div>' +
        '<div class="comment-text">' + esc(c.text) + '</div></div>' +
        '<button class="act danger" onclick="doAction(\\'delete_comment\\',\\'' + esc(c.id) + '\\',\\'Удалить этот отзыв?\\')">Удалить</button>' +
        '</div></div>').join(''));
    }
  } catch (e) {
    if (e.message === 'auth') showLogin(Boolean(KEY));
    else shell('<p class="muted">Не удалось загрузить данные</p>');
  }
}
render();
</script>
</body>
</html>`

// Откуда разрешаем запросы: продакшен и локальная разработка
const ALLOWED_ORIGINS = ['https://term1x1.github.io', 'http://localhost:5173']

function corsHeaders(request) {
  const origin = request.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

// Проверка подписи Telegram initData: гарантирует, что запрос
// пришёл из настоящего Mini App от настоящего пользователя
async function validateInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return null
    params.delete('hash')
    const dataCheckString = [...params.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join('\n')
    const enc = new TextEncoder()
    const hmac = async (keyBytes, data) => {
      const key = await crypto.subtle.importKey(
        'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      )
      return crypto.subtle.sign('HMAC', key, enc.encode(data))
    }
    const secret = await hmac(enc.encode('WebAppData'), botToken)
    const sig = new Uint8Array(await hmac(secret, dataCheckString))
    const hex = [...sig].map((b) => b.toString(16).padStart(2, '0')).join('')
    if (hex !== hash) return null
    // подпись живёт сутки — старую не принимаем
    const authDate = Number(params.get('auth_date'))
    if (!authDate || Date.now() / 1000 - authDate > 86400) return null
    const user = JSON.parse(params.get('user') ?? 'null')
    return user?.id ? user : null
  } catch {
    return null
  }
}

async function authUser(request, env) {
  const auth = request.headers.get('Authorization') ?? ''
  if (!auth.startsWith('tma ')) return null
  return validateInitData(auth.slice(4), env.BOT_TOKEN)
}

const MAX_BOOKS = 500

// Полная синхронизация библиотеки пользователя в общую базу
async function handleSync(request, env) {
  const user = await authUser(request, env)
  if (!user) return new Response('unauthorized', { status: 401, headers: corsHeaders(request) })
  if (await isBanned(env, user.id)) {
    return new Response('forbidden', { status: 403, headers: corsHeaders(request) })
  }
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.books)) {
    return new Response('bad request', { status: 400, headers: corsHeaders(request) })
  }
  const now = new Date().toISOString()
  const uid = String(user.id)
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Читатель'
  const books = body.books.slice(0, MAX_BOOKS)

  const stmts = [
    env.DB.prepare(
      `INSERT INTO users (id, name, username, photo_url, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?5)
       ON CONFLICT(id) DO UPDATE SET name=?2, username=?3, photo_url=?4, updated_at=?5`,
    ).bind(uid, name, user.username ?? null, user.photo_url ?? null, now),
    env.DB.prepare('DELETE FROM books WHERE user_id = ?1').bind(uid),
    ...books.map((b) =>
      env.DB.prepare(
        `INSERT INTO books (id, user_id, title, author, status, rating, categories,
                            cover_url, total_pages, current_page, added_at, finished_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      ).bind(
        String(b.id ?? crypto.randomUUID()).slice(0, 64),
        uid,
        String(b.title ?? '').slice(0, 300),
        String(b.author ?? '').slice(0, 200),
        ['want', 'reading', 'read'].includes(b.status) ? b.status : 'want',
        Number.isFinite(b.rating) ? b.rating : 0,
        JSON.stringify(Array.isArray(b.categories) ? b.categories.slice(0, 20) : []),
        typeof b.coverUrl === 'string' ? b.coverUrl.slice(0, 60000) : null,
        Number.isFinite(b.totalPages) ? b.totalPages : null,
        Number.isFinite(b.currentPage) ? b.currentPage : null,
        typeof b.addedAt === 'string' ? b.addedAt : now,
        typeof b.finishedAt === 'string' ? b.finishedAt : null,
      ),
    ),
  ]
  await env.DB.batch(stmts)
  return Response.json({ ok: true }, { headers: corsHeaders(request) })
}

// Список читателей с краткой статистикой
async function handleUsers(request, env) {
  // очки: прочитанная книга = 25 + её страницы / 10
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.photo_url,
            COUNT(CASE WHEN b.status='read' THEN 1 END) AS read_count,
            COUNT(CASE WHEN b.status='reading' THEN 1 END) AS reading_count,
            COUNT(CASE WHEN b.status='want' THEN 1 END) AS want_count,
            COUNT(CASE WHEN b.status='read' THEN 1 END) * 25 +
              CAST(COALESCE(SUM(CASE WHEN b.status='read' THEN COALESCE(b.total_pages, 0) ELSE 0 END), 0) / 10 AS INTEGER)
              AS points
     FROM users u LEFT JOIN books b ON b.user_id = u.id
     WHERE u.banned = 0
     GROUP BY u.id
     ORDER BY points DESC, read_count DESC, u.updated_at DESC
     LIMIT 200`,
  ).all()
  return Response.json({ users: results }, { headers: corsHeaders(request) })
}

// Список id друзей текущего пользователя
async function handleFriendsList(request, env) {
  const user = await authUser(request, env)
  if (!user) return new Response('unauthorized', { status: 401, headers: corsHeaders(request) })
  const { results } = await env.DB.prepare(
    'SELECT friend_id FROM friends WHERE user_id = ?1',
  ).bind(String(user.id)).all()
  return Response.json({ friends: results.map((r) => r.friend_id) }, { headers: corsHeaders(request) })
}

// Добавить/убрать друга (переключатель)
async function handleFriendToggle(request, env) {
  const user = await authUser(request, env)
  if (!user) return new Response('unauthorized', { status: 401, headers: corsHeaders(request) })
  const body = await request.json().catch(() => null)
  const friendId = String(body?.friend_id ?? '')
  if (!/^\d{1,20}$/.test(friendId) || friendId === String(user.id)) {
    return new Response('bad request', { status: 400, headers: corsHeaders(request) })
  }
  const uid = String(user.id)
  const existing = await env.DB.prepare(
    'SELECT 1 AS x FROM friends WHERE user_id = ?1 AND friend_id = ?2',
  ).bind(uid, friendId).first()
  if (existing) {
    await env.DB.prepare('DELETE FROM friends WHERE user_id = ?1 AND friend_id = ?2').bind(uid, friendId).run()
  } else {
    await env.DB.prepare(
      'INSERT INTO friends (user_id, friend_id, created_at) VALUES (?1, ?2, ?3)',
    ).bind(uid, friendId, new Date().toISOString()).run()
  }
  const { results } = await env.DB.prepare(
    'SELECT friend_id FROM friends WHERE user_id = ?1',
  ).bind(uid).all()
  return Response.json(
    { friends: results.map((r) => r.friend_id), added: !existing },
    { headers: corsHeaders(request) },
  )
}

// --- админ-панель ---
function isAdmin(request, env) {
  const auth = request.headers.get('Authorization') ?? ''
  return Boolean(env.ADMIN_KEY) && auth === `Bearer ${env.ADMIN_KEY}`
}

async function handleAdminOverview(request, env) {
  const [appRecords, botRecords] = await Promise.all([
    loadRecords(env, 'app:'),
    loadRecords(env, 'bot:'),
  ])
  const stats = buildStats(appRecords, botRecords)
  const counts = await env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM users) AS users,
            (SELECT COUNT(*) FROM users WHERE banned = 1) AS banned,
            (SELECT COUNT(*) FROM books) AS books,
            (SELECT COUNT(*) FROM comments) AS comments,
            (SELECT COUNT(*) FROM friends) AS friendships`,
  ).first()
  return Response.json({ ...stats, db: counts }, { headers: corsHeaders(request) })
}

async function handleAdminUsers(request, env) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.banned, u.created_at, u.updated_at,
            COUNT(CASE WHEN b.status='read' THEN 1 END) AS read_count,
            COUNT(b.id) AS books_count,
            COUNT(CASE WHEN b.status='read' THEN 1 END) * 25 +
              CAST(COALESCE(SUM(CASE WHEN b.status='read' THEN COALESCE(b.total_pages, 0) ELSE 0 END), 0) / 10 AS INTEGER)
              AS points
     FROM users u LEFT JOIN books b ON b.user_id = u.id
     GROUP BY u.id ORDER BY u.updated_at DESC`,
  ).all()
  return Response.json({ users: results }, { headers: corsHeaders(request) })
}

async function handleAdminComments(request, env) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.book_key, c.text, c.created_at, c.user_id, u.name, u.username
     FROM comments c LEFT JOIN users u ON u.id = c.user_id
     ORDER BY c.created_at DESC LIMIT 200`,
  ).all()
  return Response.json({ comments: results }, { headers: corsHeaders(request) })
}

async function handleAdminAction(request, env) {
  const body = await request.json().catch(() => null)
  const action = body?.action
  const id = String(body?.id ?? '')
  if (!id) return new Response('bad request', { status: 400, headers: corsHeaders(request) })
  if (action === 'ban' || action === 'unban') {
    await env.DB.prepare('UPDATE users SET banned = ?1 WHERE id = ?2')
      .bind(action === 'ban' ? 1 : 0, id).run()
  } else if (action === 'delete_user') {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM books WHERE user_id = ?1').bind(id),
      env.DB.prepare('DELETE FROM comments WHERE user_id = ?1').bind(id),
      env.DB.prepare('DELETE FROM friends WHERE user_id = ?1 OR friend_id = ?1').bind(id),
      env.DB.prepare('DELETE FROM users WHERE id = ?1').bind(id),
    ])
  } else if (action === 'delete_comment') {
    await env.DB.prepare('DELETE FROM comments WHERE id = ?1').bind(id).run()
  } else {
    return new Response('bad request', { status: 400, headers: corsHeaders(request) })
  }
  return Response.json({ ok: true }, { headers: corsHeaders(request) })
}

// Забанен ли пользователь (для обычных ручек)
async function isBanned(env, uid) {
  const row = await env.DB.prepare('SELECT banned FROM users WHERE id = ?1').bind(String(uid)).first()
  return row?.banned === 1
}

// --- отзывы и обсуждения ---
// Список отзывов по книге: /api/comments?key=<book_key>
async function handleCommentsList(request, env, key) {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.user_id, c.text, c.created_at,
            u.name, u.username, u.photo_url
     FROM comments c LEFT JOIN users u ON u.id = c.user_id
     WHERE c.book_key = ?1
       AND (u.banned IS NULL OR u.banned = 0)
     ORDER BY c.created_at ASC
     LIMIT 300`,
  ).bind(key).all()
  const comments = results.map((r) => ({
    id: r.id,
    text: r.text,
    created_at: r.created_at,
    user: { id: r.user_id, name: r.name ?? 'Читатель', username: r.username, photo_url: r.photo_url },
  }))
  return Response.json({ comments }, { headers: corsHeaders(request) })
}

// Новый отзыв
async function handleCommentAdd(request, env) {
  const user = await authUser(request, env)
  if (!user) return new Response('unauthorized', { status: 401, headers: corsHeaders(request) })
  if (await isBanned(env, user.id)) {
    return new Response('forbidden', { status: 403, headers: corsHeaders(request) })
  }
  const body = await request.json().catch(() => null)
  const key = String(body?.book_key ?? '').trim().slice(0, 400)
  const text = String(body?.text ?? '').trim().slice(0, 1000)
  if (!key || !text) return new Response('bad request', { status: 400, headers: corsHeaders(request) })
  const id = crypto.randomUUID()
  await env.DB.prepare(
    'INSERT INTO comments (id, book_key, user_id, text, created_at) VALUES (?1, ?2, ?3, ?4, ?5)',
  ).bind(id, key, String(user.id), text, new Date().toISOString()).run()
  return Response.json({ ok: true, id }, { headers: corsHeaders(request) })
}

// Удаление своего отзыва
async function handleCommentDelete(request, env) {
  const user = await authUser(request, env)
  if (!user) return new Response('unauthorized', { status: 401, headers: corsHeaders(request) })
  const body = await request.json().catch(() => null)
  const id = String(body?.id ?? '')
  if (!id) return new Response('bad request', { status: 400, headers: corsHeaders(request) })
  await env.DB.prepare('DELETE FROM comments WHERE id = ?1 AND user_id = ?2')
    .bind(id, String(user.id)).run()
  return Response.json({ ok: true }, { headers: corsHeaders(request) })
}

// Профиль одного читателя с его библиотекой
async function handleUserProfile(request, env, uid) {
  const user = await env.DB.prepare(
    'SELECT id, name, username, photo_url FROM users WHERE id = ?1 AND banned = 0',
  ).bind(uid).first()
  if (!user) return new Response('not found', { status: 404, headers: corsHeaders(request) })
  const { results } = await env.DB.prepare(
    `SELECT id, title, author, status, rating, categories, cover_url AS coverUrl,
            total_pages AS totalPages, current_page AS currentPage,
            added_at AS addedAt, finished_at AS finishedAt
     FROM books WHERE user_id = ?1 ORDER BY added_at DESC`,
  ).bind(uid).all()
  const books = results.map((b) => ({ ...b, categories: JSON.parse(b.categories ?? '[]') }))
  return Response.json({ user, books }, { headers: corsHeaders(request) })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Предзапрос CORS от браузера
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) })
    }

    // Приложение отмечается при открытии: /ping?uid=<telegram user id>
    if (url.pathname === '/ping') {
      const uid = url.searchParams.get('uid')
      if (uid && /^\d{1,20}$/.test(uid)) {
        await remember(env, `app:${uid}`)
      }
      return new Response('ok', { headers: corsHeaders(request) })
    }

    // --- общая база: профили и библиотеки ---
    if (url.pathname === '/api/sync' && request.method === 'POST') {
      return handleSync(request, env)
    }
    if (url.pathname === '/api/users') {
      return handleUsers(request, env)
    }
    if (url.pathname === '/api/friends' && request.method === 'GET') {
      return handleFriendsList(request, env)
    }
    // --- админ-панель (всё под паролем ADMIN_KEY) ---
    if (url.pathname.startsWith('/api/admin/')) {
      if (!isAdmin(request, env)) {
        return new Response('unauthorized', { status: 401, headers: corsHeaders(request) })
      }
      if (url.pathname === '/api/admin/overview') return handleAdminOverview(request, env)
      if (url.pathname === '/api/admin/users') return handleAdminUsers(request, env)
      if (url.pathname === '/api/admin/comments') return handleAdminComments(request, env)
      if (url.pathname === '/api/admin/action' && request.method === 'POST') {
        return handleAdminAction(request, env)
      }
      return new Response('not found', { status: 404, headers: corsHeaders(request) })
    }
    if (url.pathname === '/admin') {
      return new Response(ADMIN_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    if (url.pathname === '/api/comments' && request.method === 'GET') {
      const key = (url.searchParams.get('key') ?? '').slice(0, 400)
      if (!key) return new Response('bad request', { status: 400, headers: corsHeaders(request) })
      return handleCommentsList(request, env, key)
    }
    if (url.pathname === '/api/comments' && request.method === 'POST') {
      return handleCommentAdd(request, env)
    }
    if (url.pathname === '/api/comments/delete' && request.method === 'POST') {
      return handleCommentDelete(request, env)
    }
    if (url.pathname === '/api/friends/toggle' && request.method === 'POST') {
      return handleFriendToggle(request, env)
    }
    if (url.pathname.startsWith('/api/user/')) {
      const uid = url.pathname.slice('/api/user/'.length)
      if (/^\d{1,20}$/.test(uid)) return handleUserProfile(request, env, uid)
      return new Response('bad id', { status: 400, headers: corsHeaders(request) })
    }

    // JSON-статистика
    if (url.pathname === '/stats.json') {
      const [appRecords, botRecords] = await Promise.all([
        loadRecords(env, 'app:'),
        loadRecords(env, 'bot:'),
      ])
      return Response.json(buildStats(appRecords, botRecords), { headers: corsHeaders(request) })
    }

    // Мини-дашборд
    if (url.pathname === '/stats') {
      return new Response(DASHBOARD, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Одноразовая настройка: открыть https://<worker>/setup в браузере
    if (url.pathname === '/setup') {
      const result = await tg(env.BOT_TOKEN, 'setWebhook', {
        url: `${url.origin}/webhook`,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ['message'],
      })
      return Response.json(result)
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      // принимаем запросы только от Telegram
      if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 })
      }
      const update = await request.json()
      const msg = update.message
      if (msg?.chat?.id) {
        await remember(env, `bot:${msg.chat.id}`)
      }
      if (msg?.text?.startsWith('/start')) {
        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: WELCOME(msg.from?.first_name ?? ''),
          reply_markup: {
            inline_keyboard: [
              [{ text: '📚 Открыть библиотеку', web_app: { url: env.MINI_APP_URL } }],
            ],
          },
        })
      } else if (msg?.text) {
        // на любой другой текст — короткая подсказка с той же кнопкой
        await tg(env.BOT_TOKEN, 'sendMessage', {
          chat_id: msg.chat.id,
          text: 'Вся магия — в приложении 👇',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📚 Открыть библиотеку', web_app: { url: env.MINI_APP_URL } }],
            ],
          },
        })
      }
      return new Response('ok')
    }

    return new Response('Book tracker bot is running')
  },
}
