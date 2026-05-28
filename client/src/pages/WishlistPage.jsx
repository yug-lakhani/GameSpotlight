import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import PrettySelect from '../components/PrettySelect';

function Section({ title, subtitle, children }) {
  return (
    <section className="glass-panel p-6 sm:p-8">
      <div>
        <div className="text-xs uppercase tracking-[0.28em] text-emerald-300">Wishlist</div>
        <h2 className="mt-1 font-display text-2xl font-bold text-white">{title}</h2>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="block">
      <span className="label-text">{label}</span>
      {children}
    </div>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <div className="rounded-3xl border border-emerald-400/10 bg-emerald-400/5 p-4">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-400">{helper}</div> : null}
    </div>
  );
}

function StepCard({ step, title, text }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.3em] text-emerald-300">Step {step}</div>
      <div className="mt-2 font-display text-lg font-bold text-white">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
    </div>
  );
}

export default function WishlistPage() {
  const { user, isNormalUser, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [wishlists, setWishlists] = useState([]);
  const [games, setGames] = useState([]);
  const [wishlistName, setWishlistName] = useState('Favorites');
  const [selectedWishlistId, setSelectedWishlistId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');

  const selectedWishlist = useMemo(
    () => wishlists.find((wishlist) => String(wishlist.id || wishlist.wishlistId || '') === String(selectedWishlistId)) || null,
    [wishlists, selectedWishlistId]
  );

  const gameTitleById = useMemo(() => {
    const map = new Map();
    games.forEach((game) => {
      map.set(String(game.id), game.title);
    });
    return map;
  }, [games]);

  function getWishlistTitles(wishlist) {
    if (Array.isArray(wishlist.gameTitles) && wishlist.gameTitles.length) {
      return wishlist.gameTitles;
    }

    if (Array.isArray(wishlist.gameIds) && wishlist.gameIds.length) {
      return wishlist.gameIds.map((id) => gameTitleById.get(String(id)) || `Game ${id}`);
    }

    return [];
  }

  const wishlistOptions = useMemo(
    () =>
      wishlists.map((wishlist) => {
        const wishlistId = wishlist.id || wishlist.wishlistId || wishlist.name;
        const wishlistTitles = getWishlistTitles(wishlist);
        return {
          value: wishlistId,
          label: wishlist.name || 'Untitled wishlist',
          description: `${wishlistTitles.length || 0} games saved`
        };
      }),
    [wishlists, gameTitleById]
  );

  const gameOptions = useMemo(
    () =>
      games.map((game) => ({
        value: game.id,
        label: game.title || `Game ${game.id}`,
        description: [game.genre, game.platform].filter(Boolean).join(' • ') || 'Ready to add to a wishlist'
      })),
    [games]
  );

  const loadData = async () => {
    const [wishlistData, gamesData] = await Promise.all([api.user.wishlistList(), api.games.all()]);
    const normalizedWishlists = Array.isArray(wishlistData) ? wishlistData : [];
    setWishlists(normalizedWishlists);
    setGames(Array.isArray(gamesData) ? gamesData : []);
    if (!selectedWishlistId && normalizedWishlists[0]) {
      setSelectedWishlistId(normalizedWishlists[0].id || normalizedWishlists[0].wishlistId || '');
    }
    setNotice(normalizedWishlists.length ? 'Wishlists loaded.' : 'Create your first wishlist to organize games.');
  };

  useEffect(() => {
    if (authLoading || !user || !isNormalUser) {
      return;
    }
    let active = true;
    setBusy(true);
    loadData()
      .catch((error) => {
        if (active) {
          setNotice(error.message || 'Could not load wishlists.');
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [authLoading, isNormalUser, user]);

  const createWishlist = async () => {
    if (!wishlistName.trim()) {
      setNotice('Enter a wishlist name first.');
      return;
    }
    setBusy(true);
    try {
      await api.user.wishlistCreate(wishlistName.trim());
      setWishlistName('Favorites');
      await loadData();
      setNotice('Wishlist created.');
    } catch (error) {
      setNotice(error.message || 'Could not create wishlist.');
    } finally {
      setBusy(false);
    }
  };

  const addGameToWishlist = async () => {
    if (!selectedWishlistId || !selectedGameId) {
      setNotice('Choose both a wishlist and a game.');
      return;
    }
    setBusy(true);
    try {
      await api.user.wishlistAdd(selectedWishlistId, selectedGameId);
      await loadData();
      setNotice('Game added to wishlist.');
    } catch (error) {
      setNotice(error.message || 'Could not add game to wishlist.');
    } finally {
      setBusy(false);
    }
  };

  const removeWishlist = async (wishlistId) => {
    setBusy(true);
    try {
      await api.user.wishlistDelete(wishlistId);
      await loadData();
      setNotice('Wishlist removed.');
    } catch (error) {
      setNotice(error.message || 'Could not delete wishlist.');
    } finally {
      setBusy(false);
    }
  };

  if (!isNormalUser) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="hero-panel overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(61,214,198,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(108,140,255,0.1),transparent_26%)]" />
        <div className="relative grid gap-6 p-6 sm:p-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Wishlist</h1>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-200">
                {selectedWishlist?.name || 'No wishlist selected'}
              </span>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Create lists, pick a destination, and save games without digging through menus.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatCard label="Wishlists" value={wishlists.length} helper="Collections you created." />
              <StatCard label="Games" value={games.length} helper="Games available to save." />
              <StatCard label="Active" value={selectedWishlist?.name || 'None'} helper="Current destination list." />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/catalog" className="secondary-button">
                Browse catalog
              </Link>
              <Link to="/workspace/purchases" className="secondary-button">
                Open purchases
              </Link>
            </div>

            <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
              {notice || 'Start by creating a wishlist, then choose it before you add a game.'}
            </div>
          </div>

          <div className="grid gap-3">
            <StepCard
              step="1"
              title="Create a wishlist"
              text="Name the list in one line."
            />
            <StepCard
              step="2"
              title="Select the target list"
              text="Choose the active list from the selector or the cards below."
            />
            <StepCard
              step="3"
              title="Add a game"
              text="Save any game into the selected wishlist."
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Section title="Create a wishlist" subtitle="Give the list a clear name and start saving games right away.">
          <div className="grid gap-4">
            <Field label="Wishlist name">
              <input
                value={wishlistName}
                onChange={(event) => setWishlistName(event.target.value)}
                className="input-field"
                placeholder="Favorites, Backlog, Co-op picks..."
              />
            </Field>
            <button type="button" onClick={createWishlist} disabled={busy} className="primary-button w-fit">
              Create list
            </button>
          </div>
        </Section>

        <Section title="Add a game" subtitle="Select the list, then choose the game you want to save.">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Field label="Active wishlist">
              <PrettySelect
                value={selectedWishlistId}
                onChange={setSelectedWishlistId}
                options={wishlistOptions}
                placeholder="Select wishlist"
              />
            </Field>
            <Field label="Game to add">
              <PrettySelect
                value={selectedGameId}
                onChange={setSelectedGameId}
                options={gameOptions}
                placeholder="Select a game"
              />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={addGameToWishlist} disabled={busy} className="secondary-button">
              Save game to list
            </button>
          </div>

          <div className="mt-5 rounded-3xl border border-emerald-400/10 bg-emerald-400/5 p-4 text-sm text-slate-300">
            Active wishlist: <span className="font-semibold text-white">{selectedWishlist?.name || 'None selected'}</span>
          </div>
        </Section>
      </div>

      <Section title="Your wishlists" subtitle="Cards show the list name and a short preview of what is inside.">
        <div className="space-y-3">
          {wishlists.map((wishlist) => {
            const wishlistId = wishlist.id || wishlist.wishlistId || wishlist.name;
            const isSelected = String(selectedWishlistId) === String(wishlistId);
            const wishlistTitles = getWishlistTitles(wishlist);
            return (
              <div key={wishlistId} className={`rounded-3xl border p-4 transition duration-300 ${isSelected ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/10 bg-white/5 hover:bg-black/20'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{wishlist.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-400">{wishlistTitles.length || 0} games saved</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedWishlistId(wishlistId)} className="text-xs uppercase tracking-[0.2em] text-emerald-300">
                      Make active
                    </button>
                    <button type="button" onClick={() => removeWishlist(wishlistId)} className="text-xs uppercase tracking-[0.2em] text-warm">
                      Remove list
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-300">
                  {wishlistTitles.slice(0, 6).map((title) => (
                    <span key={title} className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                      {title}
                    </span>
                  ))}
                  {!wishlistTitles.length ? <span className="text-slate-400">No games yet. Add one using the steps above.</span> : null}
                </div>
              </div>
            );
          })}
          {!wishlists.length ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-slate-400">
              No wishlists yet. Create one above to get started.
            </div>
          ) : null}
        </div>
      </Section>
    </div>
  );
}