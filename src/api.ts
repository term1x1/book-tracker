// Поиск книг: основной источник — Google Books (огромный каталог,
// русские книги, обложки почти у всех), запасной — OpenLibrary.
// Оба бесплатны и работают без ключей.

export interface BookSuggestion {
  title: string
  author: string
  coverUrl: string | null
  totalPages: number | null
  year: number | null
}

const LIMIT = 6
const WORKER = 'https://book-tracker-bot.term1x.workers.dev'

// --- Google Books через наш воркер (прокси с кэшем и ключом) ---
async function searchGoogleBooks(query: string, signal?: AbortSignal): Promise<BookSuggestion[]> {
  const res = await fetch(`${WORKER}/api/books?q=${encodeURIComponent(query)}`, { signal })
  if (!res.ok) throw new Error(`books proxy: ${res.status}`)
  const data = (await res.json()) as { items?: BookSuggestion[] }
  return data.items ?? []
}

// --- OpenLibrary (запасной) ---
interface OLDoc {
  title?: string
  author_name?: string[]
  cover_i?: number
  number_of_pages_median?: number
  first_publish_year?: number
}

async function searchOpenLibrary(query: string, signal?: AbortSignal): Promise<BookSuggestion[]> {
  const url =
    'https://openlibrary.org/search.json?limit=6&fields=title,author_name,cover_i,number_of_pages_median,first_publish_year&q=' +
    encodeURIComponent(query)
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`OpenLibrary: ${res.status}`)
  const data = (await res.json()) as { docs?: OLDoc[] }
  return (data.docs ?? [])
    .filter((d) => d.title)
    .map((d) => ({
      title: d.title!,
      author: d.author_name?.[0] ?? '',
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
      totalPages: d.number_of_pages_median ?? null,
      year: d.first_publish_year ?? null,
    }))
}

export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookSuggestion[]> {
  // оба источника параллельно: Google первым, OpenLibrary добивает остаток
  const [google, openlib] = await Promise.allSettled([
    searchGoogleBooks(query, signal),
    searchOpenLibrary(query, signal),
  ])
  const primary = google.status === 'fulfilled' ? google.value : []
  const fallback = openlib.status === 'fulfilled' ? openlib.value : []

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const seen = new Set(primary.map((b) => norm(b.title)))
  const merged = [...primary]
  for (const b of fallback) {
    if (merged.length >= LIMIT) break
    if (seen.has(norm(b.title))) continue
    seen.add(norm(b.title))
    merged.push(b)
  }
  return merged.slice(0, LIMIT)
}
