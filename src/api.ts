// Поиск книг через OpenLibrary — бесплатный API без ключа.
// https://openlibrary.org/dev/docs/api/search

export interface BookSuggestion {
  title: string
  author: string
  coverUrl: string | null
  totalPages: number | null
  year: number | null
}

interface OLDoc {
  title?: string
  author_name?: string[]
  cover_i?: number
  number_of_pages_median?: number
  first_publish_year?: number
}

export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookSuggestion[]> {
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
