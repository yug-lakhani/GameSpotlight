import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import GameCard from '../components/GameCard';
import Pagination from '../components/Pagination';
import { api } from '../lib/api';
import { gamingGenres } from '../lib/genres';
import PrettySelect from '../components/PrettySelect';

const initialFilters = {
  title: '',
  genre: '',
  minPrice: '',
  maxPrice: ''
};

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const [filters, setFilters] = useState({
    ...initialFilters,
    title: searchParams.get('title') || '',
    genre: searchParams.get('genre') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || ''
  });
  const [aiQuery, setAiQuery] = useState(searchParams.get('aiQuery') || '');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const loadGames = async (nextFilters, page = 1, nextAiQuery = '') => {
    setLoading(true);
    setError('');
    try {
      const activeFilters = nextFilters || filters;
      const hasAiQuery = Boolean(nextAiQuery && nextAiQuery.trim());
      const hasAnyFilter = Object.values(activeFilters).some(Boolean);
      let data;
      if (hasAiQuery) {
        data = await api.games.semanticSearchPaginated(nextAiQuery.trim(), page);
      } else if (hasAnyFilter) {
        data = await api.games.filterPaginated({ ...activeFilters, page });
      } else {
        data = await api.games.allPaginated(page);
      }
      setGames(Array.isArray(data?.content) ? data.content : []);
      setCurrentPage(data?.pageNumber || 1);
      setTotalPages(data?.totalPages || 1);
      setTotalElements(data?.totalElements || 0);
    } catch (err) {
      setError(err.message || 'Unable to load catalog.');
      setGames([]);
      setCurrentPage(1);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // Watch URL search params and update filters/load games when they change
  useEffect(() => {
    const params = new URLSearchParams(queryKey);
    const title = params.get('title') || '';
    const genre = params.get('genre') || '';
    const minPrice = params.get('minPrice') || '';
    const maxPrice = params.get('maxPrice') || '';
    const ai = params.get('aiQuery') || '';

    const updatedFilters = { title, genre, minPrice, maxPrice };
    setFilters(updatedFilters);
    setAiQuery(ai);
    loadGames(updatedFilters, 1, ai);
  }, [queryKey]);

  // Use the canonical genres list for filter dropdowns and quick-genre buttons
  const genres = gamingGenres;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const query = filters.title.trim();
    const next = { ...filters };

    if (query) {
      setAiQuery(query);
      setSearchParams({ aiQuery: query }, { replace: true });
      return;
    }

    setAiQuery('');
    setSearchParams(next, { replace: true });
  };

  const handleAiSubmit = (event) => {
    event.preventDefault();
    const query = filters.title.trim();
    if (!query) {
      return;
    }

    setAiQuery(query);
    setSearchParams({ aiQuery: query }, { replace: true });
  };

  const applyQuickGenre = (genre) => {
    const next = { ...filters, genre };
    setFilters(next);
    setSearchParams(next, { replace: true });
  };

  const resetFilters = () => {
    setFilters(initialFilters);
    setAiQuery('');
    setSearchParams({}, { replace: true });
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    loadGames(filters, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <aside className="space-y-6 xl:sticky xl:top-28 xl:h-fit">
        <section className="hero-panel page-surface">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(61,214,198,0.1),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(108,140,255,0.08),transparent_24%)]" />
          <div className="relative">
            <div className="hero-badge">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Catalog
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold text-white">Browse the full storefront</h1>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Title, genre, price, AI intent</div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">Quick chips for fast filtering</div>
            </div>
            <button type="button" onClick={resetFilters} className="secondary-button mt-5 w-full">
              Reset filters
            </button>
          </div>
        </section>

        <section className="section-shell page-surface">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Filter deck</div>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="label-text">Title or keyword</label>
              <input name="title" value={filters.title} onChange={handleChange} className="input-field" placeholder="Search games" />
            </div>
            <div>
              <label className="label-text">Genre</label>
              <PrettySelect
                options={[{ value: '', label: 'Any genre', description: 'Show all available releases' }, ...genres.map((genre) => ({ value: genre, label: genre }))]}
                value={filters.genre}
                onChange={(v) => setFilters((c) => ({ ...c, genre: v }))}
                placeholder="Any genre"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <label className="label-text">Min price</label>
                <input name="minPrice" value={filters.minPrice} onChange={handleChange} className="input-field" placeholder="0" type="number" min="0" step="0.01" />
              </div>
              <div>
                <label className="label-text">Max price</label>
                <input name="maxPrice" value={filters.maxPrice} onChange={handleChange} className="input-field" placeholder="100" type="number" min="0" step="0.01" />
              </div>
            </div>
            <button type="submit" className="primary-button w-full">
              Apply filters
            </button>
            <button type="button" onClick={handleAiSubmit} className="secondary-button w-full">
              AI search by intent
            </button>
          </form>

          {aiQuery ? (
            <div className="mt-5 rounded-3xl border border-accent/30 bg-accent/10 p-4 text-sm text-slate-200">
              AI search active for: <span className="font-semibold text-white">{aiQuery}</span>
            </div>
          ) : null}

          <div className="metric-card mt-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Live summary</div>
            <div className="mt-2 text-2xl font-bold text-white">{loading ? '...' : totalElements}</div>
            <div className="mt-1 text-sm text-slate-400">Games matching the current query.</div>
          </div>
        </section>

        <section className="section-shell page-surface">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Quick genres</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {genres.slice(0, 10).map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => applyQuickGenre(genre)}
                className="chip-button normal-case tracking-normal"
              >
                {genre}
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="space-y-4">
        <div className="toolbar-shell justify-between">
          <div>
            <div className="toolbar-note">Results</div>
            <div className="mt-1 text-sm text-slate-300">Search results, filters, and AI intent all meet here.</div>
          </div>
          <div className="status-pill">
            {loading ? 'Loading results...' : `${games.length} title${games.length === 1 ? '' : 's'} on page ${currentPage}`}
          </div>
        </div>

        {error ? <div className="surface-card text-warm">{error}</div> : null}

        {loading ? (
          <div className="surface-card text-slate-300">Loading catalog...</div>
        ) : games.length ? (
          <>
            <section className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-2">
              {games.map((game) => (
                <div key={game.id} className="reveal-up">
                  <GameCard game={game} />
                </div>
              ))}
            </section>
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              isLoading={loading}
            />
          </>
        ) : (
          <div className="empty-state">No results matched your filters.</div>
        )}
      </section>
    </div>
  );
}