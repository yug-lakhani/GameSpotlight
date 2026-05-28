import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, downloadFile } from '../lib/api';
import { formatPrice } from '../lib/formatters';
import PrettySelect from '../components/PrettySelect';
import DownloadProgress from '../components/DownloadProgress';
import GameCard from '../components/GameCard';

function InfoChip({ label, value }) {
  return (
    <div className="metric-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.26em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function formatReviewDate(value) {
  if (!value) {
    return 'Just now';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function StarRating({ value = 0 }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Rating ${value} out of 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={index}
          viewBox="0 0 24 24"
          className={`h-4 w-4 ${index < value ? 'text-accent' : 'text-slate-600'}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2.5l3.09 6.26 6.91 1.01-5 4.87 1.18 6.88L12 18.27l-6.18 3.25L7 14.64l-5-4.87 6.91-1.01L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}

const FALLBACK_GALLERY_IMAGE =
  'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"%3E%3Cdefs%3E%3ClinearGradient id="g" x1="0" y1="0" x2="1" y2="1"%3E%3Cstop offset="0%25" stop-color="%23131f33"/%3E%3Cstop offset="100%25" stop-color="%23091a2d"/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width="1200" height="800" fill="url(%23g)"/%3E%3Crect x="90" y="90" width="1020" height="620" rx="36" fill="none" stroke="%23ffffff" stroke-opacity="0.14" stroke-width="6" stroke-dasharray="18 18"/%3E%3Ctext x="600" y="385" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="56" fill="%23ffffff" fill-opacity="0.82"%3EImage unavailable%3C/text%3E%3Ctext x="600" y="455" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="%2390a4c4"%3EThe original asset could not be loaded%3C/text%3E%3C/svg%3E';

const REVIEWS_PER_PAGE = 5;

function GalleryImage({ src, alt }) {
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    setCurrentSrc(src);
  }, [src]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className="h-52 w-full object-cover"
      onError={() => {
        if (currentSrc !== FALLBACK_GALLERY_IMAGE) {
          setCurrentSrc(FALLBACK_GALLERY_IMAGE);
        }
      }}
    />
  );
}

export default function GameDetailPage() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const { user, isNormalUser, loading: authLoading } = useAuth();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [wishlists, setWishlists] = useState([]);
  const [activeWishlistId, setActiveWishlistId] = useState('');
  const [userPurchases, setUserPurchases] = useState([]);
  const [isOwned, setIsOwned] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [downloadProgress, setDownloadProgress] = useState(-1);
  const [similarGames, setSimilarGames] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const wishlistOptions = useMemo(
    () => wishlists.map((wishlist) => ({
      value: wishlist.id || wishlist.wishlistId || wishlist.name,
      label: wishlist.name || 'Untitled wishlist',
      description: 'Choose where this game will be saved'
    })),
    [wishlists]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setStatus('');
    api.games
      .byId(gameId)
      .then((data) => {
        if (active) {
          setGame(data);
        }
      })
      .catch((err) => {
        if (active) {
          setStatus(err.message || 'Unable to load the game.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [gameId]);

  useEffect(() => {
    if (authLoading || !user || !isNormalUser) {
      return;
    }

    api.user
      .wishlistList()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setWishlists(list);
        setActiveWishlistId(list[0] ? list[0].id || list[0].wishlistId || '' : '');
      })
      .catch(() => {});
  }, [authLoading, isNormalUser, user]);

  // Load user purchases and check if game is owned
  useEffect(() => {
    if (authLoading || !user || !isNormalUser || !gameId) {
      return;
    }

    api.user
      .purchases()
      .then((data) => {
        const purchases = Array.isArray(data) ? data : [];
        setUserPurchases(purchases);
        // Check if this game is owned by user
        const owned = purchases.some((p) => String(p.gameId) === String(gameId));
        setIsOwned(owned);
      })
      .catch(() => {});
  }, [authLoading, isNormalUser, gameId, user]);

  useEffect(() => {
    setReviewPage(1);
  }, [gameId]);

  useEffect(() => {
    let active = true;
    if (!gameId) {
      setSimilarGames([]);
      return undefined;
    }

    api.games
      .similar(gameId)
      .then((data) => {
        if (active) {
          setSimilarGames(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (active) {
          setSimilarGames([]);
        }
      });

    return () => {
      active = false;
    };
  }, [gameId]);

  const formattedRequirements = useMemo(() => {
    if (!game?.systemRequirements) {
      return ['No system requirements provided.'];
    }
    return String(game.systemRequirements)
      .split(/[\n;|]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }, [game]);

  const reviews = Array.isArray(game?.reviews) ? game.reviews : [];
  const totalReviewPages = Math.max(1, Math.ceil(reviews.length / REVIEWS_PER_PAGE));
  const safeReviewPage = Math.min(reviewPage, totalReviewPages);
  const reviewStartIndex = (safeReviewPage - 1) * REVIEWS_PER_PAGE;
  const visibleReviews = reviews.slice(reviewStartIndex, reviewStartIndex + REVIEWS_PER_PAGE);
  const averageRating = useMemo(() => {
    if (!reviews.length) {
      return 0;
    }

    const total = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);

  const submitReview = async (event) => {
    event.preventDefault();

    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      setReviewBusy(true);
      setReviewStatus('Posting review...');
      const updatedGame = await api.games.addReview(game.id, {
        rating: Number(reviewRating),
        comment: reviewComment
      });
      setGame(updatedGame);
      setReviewComment('');
      setReviewRating(5);
      setReviewPage(Math.max(1, Math.ceil((updatedGame?.reviews?.length || 1) / REVIEWS_PER_PAGE)));
      setReviewStatus('Review posted.');
    } catch (error) {
      setReviewStatus(error.message || 'Could not post review.');
    } finally {
      setReviewBusy(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      setReviewBusy(true);
      setReviewStatus('Deleting review...');
      const updatedGame = await api.games.deleteReview(game.id);
      setGame(updatedGame);
      setReviewPage(1);
      setReviewStatus('Review deleted.');
    } catch (error) {
      setReviewStatus(error.message || 'Could not delete review.');
    } finally {
      setReviewBusy(false);
    }
  };

  const handlePurchase = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (isOwned) {
      setStatus('You already own this game.');
      return;
    }

    try {
      setStatus('Processing purchase...');
      const response = await api.user.purchaseGame(game.id);
      setStatus(typeof response === 'string' ? response : 'Purchase completed.');
      // Refresh purchases to update owned status
      const purchases = await api.user.purchases();
      const purchaseList = Array.isArray(purchases) ? purchases : [];
      setUserPurchases(purchaseList);
      const owned = purchaseList.some((p) => String(p.gameId) === String(gameId));
      setIsOwned(owned);
    } catch (error) {
      setStatus(error.message || 'Purchase failed.');
    }
  };

  const handleWishlist = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!isNormalUser) {
      setStatus('Wishlist actions are available for normal users.');
      return;
    }

    try {
      let wishlistId = activeWishlistId;
      if (!wishlistId) {
        const created = await api.user.wishlistCreate('Favorites');
        wishlistId = created?.id || created?.wishlistId;
        if (wishlistId) {
          setWishlists((current) => [...current, created]);
          setActiveWishlistId(wishlistId);
        }
      }

      if (!wishlistId) {
        throw new Error('Create a wishlist first.');
      }

      const response = await api.user.wishlistAdd(wishlistId, game.id);
      setStatus(typeof response === 'string' ? response : 'Added to wishlist.');
    } catch (error) {
      setStatus(error.message || 'Could not add to wishlist.');
    }
  };

  const handlePrevImage = () => {
    setSelectedImageIndex((current) => 
      current === 0 ? (game.galleryImageUrls?.length || 1) - 1 : current - 1
    );
  };

  const handleNextImage = () => {
    setSelectedImageIndex((current) => 
      current === (game.galleryImageUrls?.length || 1) - 1 ? 0 : current + 1
    );
  };

  const handleSecureDownload = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!isNormalUser) {
      setStatus('Only normal-user sessions can request download links from this page.');
      return;
    }

    try {
      setDownloadProgress(0);
      setStatus('Preparing secure download link...');
      const payload = await api.user.getGameDownloadUrl(game.id);
      if (!payload?.url) {
        throw new Error('Download link could not be generated.');
      }
      const platform = (game.platform || '').toLowerCase();
      const fileExt = platform.includes('windows') || platform.includes('pc') ? '.exe' : '.apk';
      const fileName = `${game.title || 'game'}${fileExt}`;
      const expectedSizeBytes = Number(game.sizeInBytes) > 0 ? Number(game.sizeInBytes) : null;
      
      await downloadFile(payload.url, fileName, (progress) => {
        setDownloadProgress(progress);
        if (progress === 100) {
          setTimeout(() => setDownloadProgress(-1), 1500);
        } else if (progress < 0) {
          setDownloadProgress(-1);
        }
      }, expectedSizeBytes);
      
      setStatus(`Download started. File will be saved as ${fileName}`);
    } catch (error) {
      setDownloadProgress(-1);
      setStatus(error.message || 'Could not start download.');
    }
  };

  if (loading) {
    return <div className="hero-panel text-slate-300">Loading game details...</div>;
  }

  if (!game) {
    return (
      <div className="hero-panel page-surface text-center">
        <div className="hero-badge mx-auto">
          <span className="h-2 w-2 rounded-full bg-warm" />
          Game unavailable
        </div>
        <div className="mt-4 text-warm">{status || 'Game not found.'}</div>
        <Link to="/catalog" className="secondary-button mt-5 inline-flex">
          Back to catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="hero-panel page-surface overflow-hidden">
          <div className="relative aspect-[16/9]">
            <img
              src={game.imageUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1400&q=80'}
              alt={game.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
              <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.26em] text-slate-300">
                {game.genre ? <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">{game.genre}</span> : null}
                {game.platform ? <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">{game.platform}</span> : null}
                {game.ageRating ? <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1">{game.ageRating}</span> : null}
              </div>
              <h1 className="mt-3 font-display text-4xl font-bold text-white sm:text-5xl">{game.title}</h1>
              <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-3">
                <div className="metric-card px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Price</div>
                  <div className="mt-1 text-sm font-semibold text-white">{formatPrice(game.price)}</div>
                </div>
                <div className="metric-card px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Downloads</div>
                  <div className="mt-1 text-sm font-semibold text-white">{game.totalDownloads != null ? String(game.totalDownloads) : '0'}</div>
                </div>
                <div className="metric-card px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Status</div>
                  <div className="mt-1 text-sm font-semibold text-white">{isOwned ? 'Owned' : 'Available'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="section-shell">
            <div className="hero-badge">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Actions
            </div>
            <div className="mt-2 font-display text-3xl font-bold text-white">{formatPrice(game.price)}</div>
            <p className="mt-2 text-sm text-slate-400">{game.downloadUrl ? 'Download is ready after purchase.' : 'Download link is not connected yet.'}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {isOwned ? (
                <button type="button" onClick={handleSecureDownload} className="primary-button">
                  Download now
                </button>
              ) : (
                <button type="button" onClick={handlePurchase} disabled={isOwned} className="primary-button disabled:cursor-not-allowed disabled:opacity-60">
                  {isOwned ? 'Already owned' : 'Buy now'}
                </button>
              )}
              <button type="button" onClick={handleWishlist} className="secondary-button">
                Add to wishlist
              </button>
            </div>
            <div className="mt-4 text-sm text-slate-300">{status}</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <InfoChip label="Developer" value={game.developer || game.developerUsername || 'Unknown'} />
            <InfoChip label="Version" value={game.version || 'N/A'} />
            <InfoChip label="Release date" value={game.releaseDate || 'TBA'} />
            <InfoChip label="Size" value={game.sizeInBytes ? `${Math.round(Number(game.sizeInBytes) / 1024 / 1024)} MB` : 'N/A'} />
            <InfoChip label="Downloads" value={game.totalDownloads != null ? String(game.totalDownloads) : '0'} />
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="text-xs uppercase tracking-[0.28em] text-accent">Description</div>
        <p className="mt-4 text-base leading-7 text-slate-300">{game.description || 'Open for purchase, wishlist, download, reviews, and similar games.'}</p>
      </section>

      {Array.isArray(game.galleryImageUrls) && game.galleryImageUrls.length ? (
        <section className="section-shell">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-accent">Gallery</div>
              <h2 className="mt-2 font-display text-2xl font-bold text-white">Captured scenes</h2>
            </div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Image {selectedImageIndex + 1} of {game.galleryImageUrls.length}</div>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-6">
            <div className="relative flex items-center gap-4">
              <button
                type="button"
                onClick={handlePrevImage}
                className="flex-shrink-0 rounded-full border border-white/20 bg-black/40 p-3 text-white hover:bg-black/60 hover:border-accent transition-all"
                aria-label="Previous image"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex-grow overflow-hidden rounded-2xl">
                <img
                  src={game.galleryImageUrls[selectedImageIndex]}
                  alt={`${game.title} screenshot ${selectedImageIndex + 1}`}
                  className="h-auto w-full object-cover aspect-[16/9]"
                  onError={(e) => {
                    if (e.target.src !== FALLBACK_GALLERY_IMAGE) {
                      e.target.src = FALLBACK_GALLERY_IMAGE;
                    }
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleNextImage}
                className="flex-shrink-0 rounded-full border border-white/20 bg-black/40 p-3 text-white hover:bg-black/60 hover:border-accent transition-all"
                aria-label="Next image"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div className="text-sm text-slate-300">
                {game.galleryImageUrls[selectedImageIndex] ? 'Screenshot' : 'N/A'}
              </div>
              <div className="flex gap-2">
                {game.galleryImageUrls.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === selectedImageIndex
                        ? 'w-8 bg-accent'
                        : 'w-2 bg-white/20 hover:bg-white/40'
                    }`}
                    aria-label={`View image ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto pb-2">
            <div className="grid grid-flow-col auto-cols-[84%] gap-4 sm:auto-cols-[68%] lg:auto-cols-[48%] xl:auto-cols-[36%]">
              {game.galleryImageUrls.map((imageUrl, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  className={`snap-start overflow-hidden rounded-3xl transition-all ${
                    index === selectedImageIndex
                      ? 'border-2 border-accent shadow-[0_18px_70px_rgba(0,0,0,0.28)]'
                      : 'border border-white/10 bg-black/20 shadow-[0_18px_70px_rgba(0,0,0,0.28)] hover:border-white/30'
                  }`}
                >
                  <div className="relative aspect-[16/10]">
                    <GalleryImage src={imageUrl} alt={`${game.title} screenshot ${index + 1}`} />
                    <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white backdrop-blur-md">
                      Shot {index + 1}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-4 pb-4 pt-8">
                      <div className="text-sm font-semibold text-white">{game.title}</div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-300">Click to view</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="section-shell">
          <h2 className="font-display text-2xl font-bold text-white">Overview</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <InfoChip label="Platform" value={game.platform || 'Any'} />
            <InfoChip label="Age rating" value={game.ageRating || 'Not set'} />
            <InfoChip label="Genre" value={game.genre || 'Not set'} />
            <InfoChip label="Price" value={formatPrice(game.price)} />
          </div>
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs uppercase tracking-[0.26em] text-slate-400">System requirements</div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {formattedRequirements.map((item, index) => (
                <li key={`${item}-${index}`} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <section className="section-shell">
              <div className="hero-badge">
                <span className="h-2 w-2 rounded-full bg-accent2" />
                Similar games
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold text-white">Similar games</h2>
              <p className="mt-2 text-sm text-slate-400">OpenSearch uses the listing content to surface close matches.</p>
              <div className="mt-5">
                {similarGames.length ? (
                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {similarGames.slice(0, 6).map((similarGame) => (
                      <div key={similarGame.id} className="reveal-up">
                        <GameCard game={similarGame} compact />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">No recommendations available yet. Add OPENSEARCH_ENABLED=true to enable AI search.</div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="space-y-4">
          <div className="section-shell">
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Quick access</div>
            <div className="mt-3 space-y-3 text-sm text-slate-300">
              {isOwned ? (
                <div>
                  Game file:{' '}
                  <button type="button" onClick={handleSecureDownload} className="text-accent hover:text-white">
                    Generate secure download
                  </button>
                </div>
              ) : (
                <div className="text-slate-400">Purchase this game to access downloads.</div>
              )}
              <div>Download URL: {game.downloadUrl ? <a href={game.downloadUrl} target="_blank" rel="noreferrer" className="text-accent hover:text-white">Open download</a> : 'Not linked'}</div>
              <div>Artwork: {game.imageUrl ? <a href={game.imageUrl} target="_blank" rel="noreferrer" className="text-accent hover:text-white">Open image</a> : 'Not linked'}</div>
            </div>
          </div>

          {wishlists.length ? (
            <div className="section-shell">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Active wishlist</div>
              <PrettySelect
                value={activeWishlistId}
                onChange={setActiveWishlistId}
                options={wishlistOptions}
                placeholder="Select wishlist"
                className="mt-3"
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="section-shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="hero-badge">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Reviews
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold text-white">Player feedback</h2>
          </div>
          <div className="metric-card px-4 py-3 text-sm text-slate-300">
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-400">Average rating</div>
            <div className="mt-1 flex items-center gap-3">
              <StarRating value={Math.round(averageRating)} />
              <span className="font-semibold text-white">{reviews.length ? averageRating.toFixed(1) : 'No ratings yet'}</span>
            </div>
          </div>
        </div>

        {user ? (
          <form onSubmit={submitReview} className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
            <div className="grid gap-4 md:grid-cols-[180px_1fr] md:items-start">
              <label className="block">
                <span className="label-text">Your rating</span>
                <select
                  value={reviewRating}
                  onChange={(event) => setReviewRating(Number(event.target.value))}
                  className="input-field mt-2"
                >
                  <option value={5}>5 - Excellent</option>
                  <option value={4}>4 - Great</option>
                  <option value={3}>3 - Good</option>
                  <option value={2}>2 - Fair</option>
                  <option value={1}>1 - Poor</option>
                </select>
              </label>

              <label className="block">
                <span className="label-text">Write a review</span>
                <textarea
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  rows="4"
                  className="input-field mt-2"
                  placeholder="Share what stood out, what could be better, or who this game is for..."
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={reviewBusy} className="primary-button">
                {reviewBusy ? 'Posting...' : 'Post review'}
              </button>
              <div className="text-sm text-slate-300">{reviewStatus}</div>
            </div>
          </form>
        ) : (
          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            Sign in to leave a review.
          </div>
        )}

        <div className="mt-6 space-y-4">
          {visibleReviews.length ? visibleReviews.map((review, index) => (
            <article key={`${review.username || 'review'}-${review.createdAt || index}`} className="surface-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">{review.username || 'Anonymous'}</div>
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{formatReviewDate(review.createdAt)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <StarRating value={Number(review.rating || 0)} />
                  {user && review.username && String(user.username).toLowerCase() === String(review.username).toLowerCase() ? (
                    <button
                      type="button"
                      onClick={handleDeleteReview}
                      disabled={reviewBusy}
                      className="text-sm text-rose-400 hover:text-rose-300"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">{review.comment}</p>
            </article>
          )) : (
            <div className="empty-state">
              No reviews yet. Be the first to post feedback.
            </div>
          )}
        </div>

        {reviews.length > REVIEWS_PER_PAGE ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
            <div>
              Showing {reviewStartIndex + 1}-{Math.min(reviewStartIndex + REVIEWS_PER_PAGE, reviews.length)} of {reviews.length} reviews
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="secondary-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setReviewPage((current) => Math.max(1, current - 1))}
                disabled={safeReviewPage <= 1}
              >
                Previous
              </button>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs uppercase tracking-[0.22em] text-slate-400">
                Page {safeReviewPage} of {totalReviewPages}
              </span>
              <button
                type="button"
                className="secondary-button px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => setReviewPage((current) => Math.min(totalReviewPages, current + 1))}
                disabled={safeReviewPage >= totalReviewPages}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <DownloadProgress progress={downloadProgress} isVisible={downloadProgress >= 0} />
    </div>
  );
}