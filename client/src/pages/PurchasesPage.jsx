import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, downloadFile } from '../lib/api';

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const getFileExtension = (platform) => {
  if (!platform) return '.apk';
  const platformLower = platform.toLowerCase();
  if (platformLower.includes('windows') || platformLower.includes('pc')) return '.exe';
  return '.apk';
};

const formatPurchaseDate = (value) => {
  if (!value) {
    return 'Date unavailable';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
};

const gameMetaCache = new Map();

function Section({ title, subtitle, children }) {
  return (
    <section className="section-shell">
      <div>
        <div className="hero-badge">
          <span className="h-2 w-2 rounded-full bg-sky-300" />
          Purchases
        </div>
        <h2 className="mt-1 font-display text-2xl font-bold text-white">{title}</h2>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <div className="metric-card border-sky-400/10 bg-sky-400/5">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-400">{helper}</div> : null}
    </div>
  );
}

function FileMeta({ gameId, purchaseDate }) {
  const [meta, setMeta] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;

    const cachedEntry = gameMetaCache.get(gameId);
    if (cachedEntry) {
      if (cachedEntry.status === 'missing') {
        setMissing(true);
        setMeta(null);
        return () => {
          active = false;
        };
      }

      setMeta(cachedEntry.data);
      setMissing(false);
      return () => {
        active = false;
      };
    }

    api.games
      .byId(gameId)
      .then((details) => {
        if (active) {
          gameMetaCache.set(gameId, { status: 'ready', data: details });
          setMeta(details);
          setMissing(false);
        }
      })
      .catch((error) => {
        if (active && error?.status === 404) {
          gameMetaCache.set(gameId, { status: 'missing' });
          setMissing(true);
          setMeta(null);
        }
      });
    return () => {
      active = false;
    };
  }, [gameId]);

  if (missing) {
    return (
      <div className="rounded-2xl border border-warm/20 bg-warm/5 px-3 py-2 text-left">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em]">
          <span className="rounded-full border border-warm/20 bg-warm/10 px-3 py-1 text-warm">Game removed</span>
        </div>
        {purchaseDate ? <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-300">Purchased on {purchaseDate}</div> : null}
      </div>
    );
  }

  if (!meta) {
    return null;
  }

  const fileExt = getFileExtension(meta.platform);
  return (
    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-slate-300">
      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{fileExt === '.exe' ? 'EXE' : 'APK'}</span>
      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{formatFileSize(meta.sizeInBytes)}</span>
    </div>
  );
}

export default function PurchasesPage() {
  const { user, isNormalUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [purchases, setPurchases] = useState([]);
  const [downloadState, setDownloadState] = useState({});
  const [purchaseQuery, setPurchaseQuery] = useState('');

  const loadData = async () => {
    const purchaseData = await api.user.purchases();
    const rawPurchases = Array.isArray(purchaseData) ? purchaseData : [];

    const normalizedPurchases = await Promise.all(
      rawPurchases.map(async (purchase) => {
        const gameId = purchase.gameId || purchase.game_id || purchase.gameID;
        let gameTitle = purchase.gameTitle || purchase.gameName || purchase.title || '';

        if (!gameTitle && gameId) {
          const cachedEntry = gameMetaCache.get(gameId);
          if (cachedEntry?.status === 'ready' && cachedEntry.data?.title) {
            gameTitle = cachedEntry.data.title;
          } else if (cachedEntry?.status !== 'missing') {
            try {
              const details = await api.games.byId(gameId);
              gameMetaCache.set(gameId, { status: 'ready', data: details });
              gameTitle = details?.title || '';
            } catch (error) {
              if (error?.status === 404) {
                gameMetaCache.set(gameId, { status: 'missing' });
              }
            }
          }
        }

        return {
          ...purchase,
          gameId,
          gameTitle: gameTitle || (gameId ? 'Unknown game' : 'Unavailable game'),
          username: purchase.username || user?.username || purchase.userId || 'Unknown user',
          purchaseDate: purchase.purchaseDate || purchase.purchasedAt || purchase.createdAt || null
        };
      })
    );

    setPurchases(normalizedPurchases);
    setNotice(normalizedPurchases.length ? 'Purchases loaded.' : 'No purchases yet.');
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
          setNotice(error.message || 'Could not load purchases.');
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
  }, [authLoading, isNormalUser, user?.username, user]);

  const downloadGame = async (gameId, gameTitle) => {
    if (!gameId) {
      setNotice('This purchase does not have a downloadable game yet.');
      return;
    }

    setDownloadState((current) => ({ ...current, [gameId]: true }));
    try {
      const gameDetails = await api.games.byId(gameId);
      const fileExt = getFileExtension(gameDetails?.platform);
      const fileSize = formatFileSize(gameDetails?.sizeInBytes);
      const confirmMessage = `Download ${gameTitle || 'this game'}?\n\nFile type: ${fileExt}\nFile size: ${fileSize}`;
      if (!window.confirm(confirmMessage)) {
        setNotice('Download cancelled.');
        return;
      }

      setNotice('Preparing secure download link...');
      const downloadInfo = await api.user.getGameDownloadUrl(gameId);
      const url = typeof downloadInfo === 'string' ? downloadInfo : downloadInfo?.url;
      if (!url) {
        throw new Error('Download link is unavailable.');
      }

      const fileName = `${gameTitle || 'game'}${fileExt}`;
      await downloadFile(url, fileName);
      setNotice(`Download started for ${gameTitle || 'your game'}. File will be saved as ${fileName}`);
    } catch (error) {
      if (error?.status === 404) {
        setNotice('Game does not exist.');
      } else {
        setNotice(error.message || 'Could not start download.');
      }
    } finally {
      setDownloadState((current) => ({ ...current, [gameId]: false }));
    }
  };

  const viewGame = async (gameId) => {
    if (!gameId) {
      setNotice('Game does not exist.');
      return;
    }

    try {
      await api.games.byId(gameId);
      navigate(`/games/${gameId}`);
    } catch {
      setNotice('Game does not exist.');
    }
  };

  const purchaseCount = useMemo(() => purchases.length, [purchases]);
  const filteredPurchases = useMemo(() => {
    const query = purchaseQuery.trim().toLowerCase();
    if (!query) {
      return purchases;
    }

    return purchases.filter((purchase) => {
      const haystack = [purchase.gameTitle, purchase.username, purchase.purchaseDate, purchase.gameId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [purchases, purchaseQuery]);

  if (!isNormalUser) {
    return null;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <aside className="space-y-6 xl:sticky xl:top-28 xl:h-fit">
        <section className="hero-panel page-surface">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(61,214,198,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(108,140,255,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_35%)]" />
          <div className="absolute -right-14 top-0 h-36 w-36 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative">
            <div className="hero-badge">
              <span className="h-2 w-2 rounded-full bg-sky-300" />
              Library
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">Purchase history</h1>
              <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-sky-200">
                {user?.username || 'Guest'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Review what you own, reopen game pages, and re-download from one clean list.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <StatCard label="Purchases" value={purchaseCount} helper="Games in your library." />
              <StatCard label="Downloads" value={purchaseCount ? 'Ready' : 'None'} helper="Re-download any owned game." />
              <StatCard label="Layout" value="Focused" helper="Fast actions on the right, context on the left." />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/catalog" className="secondary-button">
                Browse catalog
              </Link>
              <Link to="/workspace/wishlist" className="secondary-button">
                Open wishlist
              </Link>
            </div>

            <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              Each row shows the game, the date, and a safe re-download action.
            </div>
            <div className="mt-4 text-sm text-slate-400">{notice}</div>
          </div>
        </section>

      </aside>

      <main className="space-y-6">
        <Section title="Your library" subtitle="Everything you own, ready for quick search or download.">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Purchases" value={purchaseCount} helper="Games currently in your account history." />
            <StatCard label="Ready to download" value={purchaseCount ? 'Yes' : 'No'} helper="Use the download button on any owned game." />
            <StatCard label="Mode" value="Library" helper="Focused on fast re-downloads and game details." />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.26em] text-slate-400">Search</div>
            <input
              value={purchaseQuery}
              onChange={(event) => setPurchaseQuery(event.target.value)}
              placeholder="Search by game, user, or date"
              className="input-field min-w-0 flex-1 border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500"
            />
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.22em] text-slate-300">
              {filteredPurchases.length} shown
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {filteredPurchases.map((purchase, index) => (
              <div
                key={purchase.id || `${purchase.gameId || 'game'}-${purchase.purchaseDate || 'date'}-${index}`}
                className="group relative overflow-hidden rounded-3xl border border-sky-400/10 bg-sky-400/5 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-0.5 hover:border-sky-400/30 hover:bg-sky-400/10 hover:shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_32%,transparent_68%,rgba(108,140,255,0.05))] opacity-0 transition group-hover:opacity-100" />
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="relative flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-white transition group-hover:text-accent">{purchase.gameTitle}</div>
                      {purchase.gameId ? <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">Owned</span> : null}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">Purchased by {purchase.username}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-300">
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Purchased {formatPurchaseDate(purchase.purchaseDate)}</span>
                      {purchase.gameTitle ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">Game {purchase.gameTitle}</span> : null}
                    </div>
                  </div>
                  <div className="relative flex flex-wrap items-center gap-2">
                    {purchase.gameId ? (
                      <>
                        <button
                          type="button"
                          onClick={() => viewGame(purchase.gameId)}
                          className="secondary-button px-4 py-2 text-xs shadow-sm transition hover:-translate-y-0.5"
                        >
                          View game
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadGame(purchase.gameId, purchase.gameTitle)}
                          disabled={busy || downloadState[purchase.gameId]}
                          className="primary-button px-4 py-2 text-xs shadow-lg shadow-accent/20 transition hover:-translate-y-0.5 disabled:hover:translate-y-0"
                        >
                          {downloadState[purchase.gameId] ? 'Preparing...' : 'Download again'}
                        </button>
                        <FileMeta gameId={purchase.gameId} purchaseDate={purchase.purchaseDate} />
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {!filteredPurchases.length ? (
              <div className="empty-state">
                {purchaseQuery.trim()
                    ? 'No purchases match your search. Try a different game name or date.'
                  : 'You do not have any purchases yet. Buy a game from the catalog or a game page to populate this view.'}
              </div>
            ) : null}
          </div>
        </Section>
      </main>
    </div>
  );
}