import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GameCard from '../components/GameCard';
import { api } from '../lib/api';
import { formatPrice } from '../lib/formatters';
import { prefetchRoute } from '../lib/routePrefetch';

function HeroStat({ label, value }) {
  return (
    <div className="metric-card">
      <div className="text-xs uppercase tracking-[0.28em] text-slate-400">{label}</div>
      <div className="mt-2 font-display text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function FeatureCard({ to, title, value, icon, tone = 'accent' }) {
  const toneClass = tone === 'accent2' ? 'from-accent2/30 to-accent2/5 border-accent2/20' : tone === 'warm' ? 'from-warm/30 to-warm/5 border-warm/20' : 'from-accent/30 to-accent/5 border-accent/20';
  const prefetchTarget = () => prefetchRoute(to);

  return (
    <Link
      to={to}
      onMouseEnter={prefetchTarget}
      onFocus={prefetchTarget}
      onTouchStart={prefetchTarget}
      className={`group surface-card block bg-gradient-to-br ${toneClass}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="hero-badge bg-black/20 text-white/90">Quick access</div>
          <div className="mt-4 font-display text-xl font-bold text-white">{title}</div>
          <div className="mt-2 text-sm text-slate-300">{value}</div>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-black/20 text-white transition duration-300 group-hover:scale-105 group-hover:border-white/20">
          {icon}
        </div>
      </div>
      <div className="mt-5 text-sm font-semibold text-accent2">Open</div>
    </Link>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.games
      .allPaginated(1)
      .then((data) => {
        if (!active) return;
        setGames(Array.isArray(data?.content) ? data.content : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load games.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const genres = useMemo(() => {
    const unique = new Set(games.map((game) => game.genre).filter(Boolean));
    return Array.from(unique).slice(0, 8);
  }, [games]);

  const featured = games.slice(0, 6);
  const newest = [...games]
    .sort((left, right) => String(right.releaseDate || '').localeCompare(String(left.releaseDate || '')))
    .slice(0, 3);

  const quickLaunch = useMemo(() => {
    const items = [
      { to: '/catalog', title: 'Catalog', value: 'Browse every release with AI search, filters, and paging.', tone: 'accent', icon: '⌕' },
      { to: '/catalog?genre=Action', title: 'Genres', value: 'Jump straight into the most active collections.', tone: 'accent2', icon: '◌' },
      { to: '/workspace/wishlist', title: 'Wishlist', value: 'Keep your saved games in one place.', tone: 'warm', icon: '♥' },
      { to: '/workspace/purchases', title: 'Purchases', value: 'Review bought titles and recent activity.', tone: 'accent', icon: '↗' }
    ];

    return items;
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`/catalog?aiQuery=${encodeURIComponent(search.trim())}`);
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="hero-panel page-surface">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(61,214,198,0.15),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(108,140,255,0.15),transparent_25%)]" />
          <div className="absolute -right-8 top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl float-slow" />
          <div className="absolute bottom-0 left-10 h-56 w-56 rounded-full bg-accent2/10 blur-3xl float-slower" />
          <div className="relative max-w-2xl reveal-up">
            <div className="hero-badge">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Game marketplace control center
            </div>
            <h1 className="mt-5 max-w-xl font-display text-4xl font-bold leading-tight text-white sm:text-6xl">
              Everything you need, surfaced in one place.
            </h1>
            <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
              <div className="metric-card">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Search</div>
                <div className="mt-2 font-semibold text-white">AI, genre, title</div>
              </div>
              <div className="metric-card">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Library</div>
                <div className="mt-2 font-semibold text-white">Wishlist, purchases</div>
              </div>
              <div className="metric-card">
                <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Creator</div>
                <div className="mt-2 font-semibold text-white">Developer workspace</div>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3 reveal-delay-1">
              <Link
                to="/catalog"
                onMouseEnter={() => prefetchRoute('/catalog')}
                onFocus={() => prefetchRoute('/catalog')}
                onTouchStart={() => prefetchRoute('/catalog')}
                className="primary-button"
              >
                Explore catalog
              </Link>
              <Link
                to="/workspace/wishlist"
                onMouseEnter={() => prefetchRoute('/workspace/wishlist')}
                onFocus={() => prefetchRoute('/workspace/wishlist')}
                onTouchStart={() => prefetchRoute('/workspace/wishlist')}
                className="secondary-button"
              >
                Wishlist
              </Link>
              <Link
                to="/workspace/purchases"
                onMouseEnter={() => prefetchRoute('/workspace/purchases')}
                onFocus={() => prefetchRoute('/workspace/purchases')}
                onTouchStart={() => prefetchRoute('/workspace/purchases')}
                className="secondary-button"
              >
                Purchases
              </Link>
            </div>
            <form onSubmit={submitSearch} className="mt-7 max-w-2xl reveal-delay-2">
              <label className="label-text">Quick search</label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="input-field flex-1"
                  placeholder="Try a title, studio, genre, or alias"
                />
                <button type="submit" className="secondary-button sm:px-6">
                  Search
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                <Link to="/catalog?genre=Action" className="chip-button">
                  Action
                </Link>
                <Link to="/catalog?genre=Adventure" className="chip-button">
                  Adventure
                </Link>
                <Link to="/catalog?genre=Racing" className="chip-button">
                  Racing
                </Link>
              </div>
            </form>
            <div className="mt-8 flex flex-wrap gap-2 reveal-delay-3">
              {genres.map((genre) => (
                <Link key={genre} to={`/catalog?genre=${encodeURIComponent(genre)}`} className="chip-button normal-case tracking-normal">
                  {genre}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <HeroStat label="Games listed" value={String(games.length).padStart(2, '0')} />
            <HeroStat label="Featured picks" value={String(featured.length).padStart(2, '0')} />
          </div>
          <div className="surface-card reveal-up">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Newest drop</div>
              <Link to="/catalog" className="text-xs font-semibold uppercase tracking-[0.24em] text-accent2 hover:text-white">
                Open catalog
              </Link>
            </div>
            {newest[0] ? (
              <div className="mt-4 space-y-3">
                <div className="font-display text-2xl font-bold text-white">{newest[0].title}</div>
                <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.24em] text-slate-400">
                  <span>{newest[0].genre || 'Genre'}</span>
                  <span>•</span>
                  <span>{newest[0].platform || 'Platform'}</span>
                  <span>•</span>
                  <span>{formatPrice(newest[0].price)}</span>
                </div>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-400">No games available yet.</div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4 reveal-up">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="section-heading">Quick launch</h2>
            <p className="section-copy">Common actions are exposed as direct entry points instead of buried in menus.</p>
          </div>
          <Link
            to="/catalog"
            onMouseEnter={() => prefetchRoute('/catalog')}
            onFocus={() => prefetchRoute('/catalog')}
            onTouchStart={() => prefetchRoute('/catalog')}
            className="text-sm font-semibold text-accent hover:text-white"
          >
            Browse all
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {quickLaunch.map((item) => (
            <FeatureCard key={item.to} {...item} />
          ))}
        </div>
      </section>

      <section className="space-y-4 reveal-up">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="section-heading">Featured on the shelf</h2>
            <p className="section-copy">The most important listings stay visible and tappable.</p>
          </div>
          <Link
            to="/catalog"
            onMouseEnter={() => prefetchRoute('/catalog')}
            onFocus={() => prefetchRoute('/catalog')}
            onTouchStart={() => prefetchRoute('/catalog')}
            className="text-sm font-semibold text-accent hover:text-white"
          >
            View all
          </Link>
        </div>
        {loading ? (
          <div className="surface-card text-slate-300">Loading games...</div>
        ) : error ? (
          <div className="surface-card text-warm">{error}</div>
        ) : featured.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {featured.map((game) => (
              <div key={game.id} className="reveal-up">
                <GameCard game={game} />
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No games found.</div>
        )}
      </section>
    </div>
  );
}