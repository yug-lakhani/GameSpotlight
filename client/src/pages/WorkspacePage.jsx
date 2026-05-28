import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, downloadFile } from '../lib/api';
import { gamingGenres } from '../lib/genres';
import PrettySelect from '../components/PrettySelect';
import IconStar from '../components/IconStar';

// Helper function to format file sizes
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return 'Unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

// Helper function to get file extension from platform
const getFileExtension = (platform) => {
  if (!platform) return '.apk';
  const platformLower = platform.toLowerCase();
  if (platformLower.includes('android')) return '.apk';
  if (platformLower.includes('windows') || platformLower.includes('pc')) return '.exe';
  return '.apk';
};

const emptyGameForm = {
  title: '',
  genre: '',
  description: '',
  version: '',
  platform: '',
  ageRating: '',
  systemRequirements: '',
  releaseDate: '',
  price: '',
  developer: ''
};

function Section({ title, subtitle, children, action, toneClassName = '' }) {
  return (
    <section className={`section-shell ${toneClassName}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="hero-badge">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Workspace
          </div>
          <h2 className="mt-1 font-display text-2xl font-bold text-white">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        {action}
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

function MiniButton({ children, ...props }) {
  return (
    <button type="button" {...props} className="secondary-button px-4 py-2 text-xs uppercase tracking-[0.22em]">
      {children}
    </button>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <div className="metric-card">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-400">{helper}</div> : null}
    </div>
  );
}

function RoleBadge({ role }) {
  return <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{role}</span>;
}

function SectionBadge({ children, tone = 'neutral' }) {
  const toneClasses = {
    neutral: 'border-white/10 bg-white/5 text-slate-300',
    wishlist: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    purchases: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
    profile: 'border-violet-400/20 bg-violet-400/10 text-violet-200'
  };

  return (
    <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em] ${toneClasses[tone] || toneClasses.neutral}`}>
      {children}
    </span>
  );
}

function GameMetadataBadges({ gameId, purchaseDate }) {
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const fetch = async () => {
      try {
        const details = await api.games.byId(gameId);
        if (active) {
          setMetadata(details);
          setError(false);
        }
      } catch {
        if (active) {
          setError(true);
        }
      }
    };
    fetch();
    return () => {
      active = false;
    };
  }, [gameId]);

  if (error) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.22em]">
        <span className="rounded-full border border-warm/20 bg-warm/10 px-3 py-1 text-warm">Game removed</span>
        {purchaseDate ? <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">Bought {purchaseDate}</span> : null}
      </div>
    );
  }

  if (!metadata) {
    return null;
  }

  const fileExt = getFileExtension(metadata.platform);
  const fileSize = formatFileSize(metadata.sizeInBytes);

  return (
    <>
      <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
        {fileExt === '.apk' ? '📦 APK' : '💻 EXE'}
      </div>
      <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
        {fileSize}
      </div>
    </>
  );
}

export default function WorkspacePage() {
  const { user, isAdmin, isDeveloper, isNormalUser, refreshSession, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [profileName, setProfileName] = useState(user?.username || '');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [wishlists, setWishlists] = useState([]);
  const [wishlistName, setWishlistName] = useState('Favorites');
  const [games, setGames] = useState([]);
  const [myGames, setMyGames] = useState([]);
  const [users, setUsers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [selectedWishlistId, setSelectedWishlistId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [adminUserSearch, setAdminUserSearch] = useState('');
  const [adminGameSearch, setAdminGameSearch] = useState('');
  const [gameForm, setGameForm] = useState(emptyGameForm);
  const [logoFileName, setLogoFileName] = useState('');
  const [gameFileName, setGameFileName] = useState('');
  const [galleryFileNames, setGalleryFileNames] = useState([]);
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [binaryGameFile, setBinaryGameFile] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [downloadState, setDownloadState] = useState({});

  const userSummary = useMemo(() => {
    const selectedWishlist = wishlists.find((wishlist) => String(wishlist.id || wishlist.wishlistId || '') === String(selectedWishlistId)) || null;
    const selectedGame = games.find((game) => String(game.id) === String(selectedGameId)) || null;

    return {
      wishlistCount: wishlists.length,
      purchaseCount: purchases.length,
      selectedWishlistName: selectedWishlist?.name || 'None selected',
      selectedGameTitle: selectedGame?.title || 'No game selected'
    };
  }, [wishlists, purchases, selectedWishlistId, selectedGameId, games]);

  const selectedGameOwned = useMemo(
    () => purchases.some((purchase) => String(purchase.gameId) === String(selectedGameId)),
    [purchases, selectedGameId]
  );

  const filteredAdminUsers = useMemo(() => {
    const query = adminUserSearch.trim().toLowerCase();
    if (!query) {
      return users;
    }

    return users.filter((entry) => {
      const haystack = [entry.username, entry.role, entry.email, entry.displayName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [users, adminUserSearch]);

  const filteredAdminGames = useMemo(() => {
    const query = adminGameSearch.trim().toLowerCase();
    if (!query) {
      return games;
    }

    return games.filter((game) => {
      const haystack = [game.title, game.genre, game.platform, game.developer]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [games, adminGameSearch]);

  const loadCommon = async () => {
    const allGames = await api.games.all();
    setGames(Array.isArray(allGames) ? allGames : []);
  };

  const loadUserData = async () => {
    const [wishlistData, purchaseData, profileData] = await Promise.all([api.user.wishlistList(), api.user.purchases(), api.user.profile()]);
    setWishlists(Array.isArray(wishlistData) ? wishlistData : []);
    setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
    setProfileName(profileData?.username || user?.username || '');
    if (!selectedWishlistId && wishlistData?.[0]) {
      setSelectedWishlistId(wishlistData[0].id || wishlistData[0].wishlistId || '');
    }
  };

  const downloadGame = async (gameId, gameTitle) => {
    if (!gameId) {
      setNotice('This purchase does not have a downloadable game yet.');
      return;
    }

    setDownloadState((current) => ({ ...current, [gameId]: true }));
    try {
      // Fetch game details to show file info
      const gameDetails = await api.games.byId(gameId);
      const fileSize = gameDetails?.sizeInBytes;
      const platform = gameDetails?.platform || 'Android';
      const fileExt = getFileExtension(platform);
      const fileSizeFormatted = formatFileSize(fileSize);

      // Show confirmation with file info
      const confirmMsg = `Download ${gameTitle || 'Game'} (${fileSizeFormatted})?\n\nFile type: ${fileExt}\nPlatform: ${platform}`;
      if (!window.confirm(confirmMsg)) {
        setNotice('Download cancelled.');
        setDownloadState((current) => ({ ...current, [gameId]: false }));
        return;
      }

      setNotice(`Preparing download for ${gameTitle || 'your game'}...`);
      
      const downloadInfo = await api.user.getGameDownloadUrl(gameId);
      const url = typeof downloadInfo === 'string' ? downloadInfo : downloadInfo?.url;
      if (!url) {
        throw new Error('Download link is unavailable.');
      }

      const fileName = gameTitle ? `${gameTitle}${fileExt}` : `game${fileExt}`;
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

  const loadDeveloperData = async () => {
    const profileData = await api.developer.profile();
    const developerUsername = profileData?.username || user?.username || profileName || '';
    const gamesResponse = developerUsername ? await api.developer.games(developerUsername) : [];
    setMyGames(Array.isArray(gamesResponse) ? gamesResponse : []);
    setProfileName(profileData?.username || user?.username || '');
    setGameForm((current) => ({
      ...current,
      developer: current.developer || developerUsername
    }));
  };

  const loadAdminData = async () => {
    const [usersResponse, gamesResponse, purchasesResponse, profileData] = await Promise.all([
      api.admin.users(),
      api.admin.games(),
      api.admin.purchases(),
      api.admin.profile()
    ]);
    setUsers(Array.isArray(usersResponse) ? usersResponse : []);
    setGames(Array.isArray(gamesResponse) ? gamesResponse : []);
    setPurchases(Array.isArray(purchasesResponse) ? purchasesResponse : []);
    setProfileName(profileData?.username || user?.username || '');
  };

  useEffect(() => {
    setProfileName(user?.username || '');
  }, [user?.username]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let active = true;
    const load = async () => {
      setBusy(true);
      setNotice('Loading workspace...');
      try {
        await loadCommon();
        if (isNormalUser) {
          await loadUserData();
        } else if (isDeveloper) {
          await loadDeveloperData();
        } else if (isAdmin) {
          await loadAdminData();
        }
        if (active) {
          setNotice('Workspace ready.');
        }
      } catch (error) {
        if (active) {
          setNotice(error.message || 'Could not load workspace.');
        }
      } finally {
        if (active) {
          setBusy(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [authLoading, isNormalUser, isDeveloper, isAdmin]);

  // Load selected game into form
  useEffect(() => {
    if (!selectedGameId) {
      resetGameForm();
      return;
    }

    const selectedGame = games.find((game) => String(game.id) === String(selectedGameId));
    if (selectedGame) {
      setGameForm({
        title: selectedGame.title || '',
        genre: selectedGame.genre || '',
        description: selectedGame.description || '',
        version: selectedGame.version || '',
        platform: selectedGame.platform || '',
        ageRating: selectedGame.ageRating || '',
        systemRequirements: selectedGame.systemRequirements || '',
        releaseDate: selectedGame.releaseDate || '',
        price: selectedGame.price || '',
        developer: selectedGame.developer || selectedGame.developerUsername || ''
      });
      // Show current assets as read-only info (not in gameForm)
      setLogoFileName(selectedGame.imageUrl ? 'Current cover image set' : 'No cover image');
      setGameFileName(selectedGame.gameFileUrl ? 'Current game file set' : 'No game file');
      setGalleryFileNames(selectedGame.galleryImageUrls?.length ? [`${selectedGame.galleryImageUrls.length} gallery images`] : []);
      // Clear file inputs so old files aren't re-uploaded
      setCoverImageFile(null);
      setBinaryGameFile(null);
      setGalleryFiles([]);
    }
  }, [selectedGameId, games]);

  const updateForm = (setter) => (event) => {
    const { name, value } = event.target;
    setter((current) => ({ ...current, [name]: value }));
  };

  const resetGameForm = () => {
    setGameForm(emptyGameForm);
    setLogoFileName('');
    setGameFileName('');
    setGalleryFileNames([]);
    setCoverImageFile(null);
    setBinaryGameFile(null);
    setGalleryFiles([]);
  };

  const handleLogoFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoFileName('');
      setCoverImageFile(null);
      return;
    }
    setLogoFileName(file.name);
    setCoverImageFile(file);
  };

  const handleGameFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setGameFileName('');
      setBinaryGameFile(null);
      return;
    }
    setGameFileName(file.name);
    setBinaryGameFile(file);
  };

  const handleGalleryFiles = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      setGalleryFileNames([]);
      setGalleryFiles([]);
      return;
    }
    setGalleryFileNames(files.map((file) => file.name));
    setGalleryFiles(files);
  };

  const uploadAsset = async (file) => {
    const metadata = await api.storage.uploadFile(file, user?.username || profileName || 'unknown');
    return metadata?.url || '';
  };

  const updateProfile = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.user.updateProfile(profileName);
      await refreshSession();
      setNotice('Profile updated.');
    } catch (error) {
      setNotice(error.message || 'Profile update failed.');
    } finally {
      setBusy(false);
    }
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.user.changePassword(passwordForm);
      setPasswordForm({ currentPassword: '', newPassword: '' });
      setNotice('Password updated.');
    } catch (error) {
      setNotice(error.message || 'Password update failed.');
    } finally {
      setBusy(false);
    }
  };

  const createWishlist = async () => {
    if (!wishlistName.trim()) {
      setNotice('Enter a wishlist name first.');
      return;
    }
    setBusy(true);
    try {
      await api.user.wishlistCreate(wishlistName.trim());
      setWishlistName('');
      await loadUserData();
      setNotice('Wishlist created successfully!');
    } catch (error) {
      setNotice(error.message || 'Wishlist creation failed.');
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
      await loadUserData();
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
      await loadUserData();
      setNotice('Wishlist removed.');
    } catch (error) {
      setNotice(error.message || 'Could not delete wishlist.');
    } finally {
      setBusy(false);
    }
  };

  const purchaseGame = async () => {
    if (!selectedGameId) {
      setNotice('Choose a game first.');
      return;
    }

    if (selectedGameOwned) {
      setNotice('You already own this game.');
      return;
    }
    setBusy(true);
    try {
      const selectedGame = games.find((game) => String(game.id) === String(selectedGameId));
      await api.user.purchaseGame(selectedGameId);
      await loadUserData();
      setNotice('Purchase recorded. Starting your download...');
      await downloadGame(selectedGameId, selectedGame?.title);
    } catch (error) {
      setNotice(error.message || 'Purchase failed.');
    } finally {
      setBusy(false);
    }
  };

  const createGame = async (payload, isAdminMode = false) => {
    setBusy(true);
    try {
      if (isAdminMode) {
        await api.admin.createGame(payload);
        await loadAdminData();
      } else {
        if (!coverImageFile) {
          setNotice('Please choose a cover image before creating the game.');
          return;
        }
        if (!binaryGameFile) {
          setNotice('Please choose a game file (.apk or .exe) before creating the game.');
          return;
        }

        const [imageUrl, gameFileUrl, galleryImageUrls] = await Promise.all([
          uploadAsset(coverImageFile),
          uploadAsset(binaryGameFile),
          Promise.all(galleryFiles.map((file) => uploadAsset(file)))
        ]);

        await api.developer.createGame({
          ...payload,
          imageUrl,
          gameFileUrl,
          galleryImageUrls,
          sizeInBytes: binaryGameFile.size,
          developer: user?.username || profileName || payload.developer || ''
        });
        await loadDeveloperData();
      }
      resetGameForm();
      setNotice('Game created.');
    } catch (error) {
      setNotice(error.message || 'Could not create game.');
    } finally {
      setBusy(false);
    }
  };

  const updateGame = async (gameId, payload, isAdminMode = false) => {
    if (!gameId) {
      setNotice('Select a game first.');
      return;
    }
    setBusy(true);
    try {
      if (isAdminMode) {
        await api.admin.updateGame(gameId, payload);
        await loadAdminData();
      } else {
        // Allow metadata-only updates or updates with new files
        const updates = { ...payload };
        
        // Upload new files if provided
        if (coverImageFile) {
          updates.imageUrl = await uploadAsset(coverImageFile);
        }
        if (binaryGameFile) {
          updates.gameFileUrl = await uploadAsset(binaryGameFile);
          updates.sizeInBytes = binaryGameFile.size;
        }
        if (galleryFiles.length > 0) {
          updates.galleryImageUrls = await Promise.all(galleryFiles.map((file) => uploadAsset(file)));
        }
        
        updates.developer = user?.username || profileName || payload.developer || '';

        await api.developer.updateGame(gameId, updates);
        await loadDeveloperData();
      }
      setNotice('Game updated successfully!');
      resetGameForm();
    } catch (error) {
      setNotice(error.message || 'Could not update game.');
    } finally {
      setBusy(false);
    }
  };

  const deleteGame = async (gameId, isAdminMode = false) => {
    setBusy(true);
    try {
      if (isAdminMode) {
        await api.admin.deleteGame(gameId);
        await loadAdminData();
      } else {
        await api.developer.deleteGame(gameId);
        await loadDeveloperData();
      }
      setNotice('Game deleted.');
    } catch (error) {
      setNotice(error.message || 'Could not delete game.');
    } finally {
      setBusy(false);
    }
  };

  const deleteUser = async (userId) => {
    if (!userId) {
      setNotice('Select a user first.');
      return;
    }
    setBusy(true);
    try {
      await api.admin.deleteUser(userId);
      await loadAdminData();
      setNotice('User deleted.');
    } catch (error) {
      setNotice(error.message || 'Could not delete user.');
    } finally {
      setBusy(false);
    }
  };

  const gamePayload = useMemo(() => ({
    title: gameForm.title,
    genre: gameForm.genre,
    description: gameForm.description,
    version: gameForm.version,
    platform: gameForm.platform,
    ageRating: gameForm.ageRating,
    systemRequirements: gameForm.systemRequirements,
    releaseDate: gameForm.releaseDate || null,
    price: gameForm.price === '' ? null : Number(gameForm.price),
    developer: gameForm.developer || user?.username || profileName || ''
  }), [gameForm, user?.username, profileName]);

  return (
    <div className="space-y-6">
      <section className="hero-panel page-surface">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold text-white">Workspace</h1>
          <RoleBadge role={user?.role || 'GUEST'} />
          <div className="text-xs text-slate-500">Your account tools and shortcuts live here.</div>
        </div>
        {isNormalUser ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/workspace/wishlist" className="secondary-button">
              Wishlists
            </Link>
            <Link to="/workspace/purchases" className="secondary-button">
              Purchases
            </Link>
            <Link to="/catalog" className="secondary-button">
              Browse
            </Link>
          </div>
        ) : null}
        <div className="mt-4 text-sm text-slate-400">{notice}</div>
      </section>

      {isNormalUser ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Your library" subtitle="Profile, wishlist, and purchases are grouped together." toneClassName="border-emerald-400/10 bg-emerald-400/5">
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard label="Wishlists" value={userSummary.wishlistCount} helper="" />
              <StatCard label="Purchases" value={userSummary.purchaseCount} helper="" />
              <StatCard label="Selected" value={userSummary.selectedGameTitle} helper="" />
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <form onSubmit={updateProfile} className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Profile</div>
                </div>
                <Field label="Display username">
                  <input name="profileName" value={profileName} onChange={(event) => setProfileName(event.target.value)} className="input-field" placeholder="Choose a display name" />
                </Field>
                <div className="flex flex-wrap gap-3">
                  <button disabled={busy} className="primary-button">Save profile</button>
                  <button type="button" onClick={() => setProfileName(user?.username || '')} className="secondary-button">Reset</button>
                </div>
              </form>
              <form onSubmit={updatePassword} className="space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Security</div>
                </div>
                <Field label="Current password">
                  <input name="currentPassword" type="password" value={passwordForm.currentPassword} onChange={updateForm(setPasswordForm)} className="input-field" placeholder="Enter current password" />
                </Field>
                <Field label="New password">
                  <input name="newPassword" type="password" value={passwordForm.newPassword} onChange={updateForm(setPasswordForm)} className="input-field" placeholder="Enter a new password" />
                </Field>
                <div className="flex flex-wrap gap-3">
                  <button disabled={busy} className="secondary-button">Change password</button>
                  <button type="button" onClick={() => setPasswordForm({ currentPassword: '', newPassword: '' })} className="secondary-button">Clear</button>
                </div>
              </form>
            </div>

            <div className="mt-6 rounded-3xl border border-emerald-400/10 bg-emerald-400/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Quick actions</div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                <Field label="Wishlist name">
                  <input value={wishlistName} onChange={(event) => setWishlistName(event.target.value)} className="input-field" placeholder="Favorites, Backlog, Party games..." />
                </Field>
                <Field label="Game">
                  <select value={selectedGameId} onChange={(event) => setSelectedGameId(event.target.value)} className="input-field select-field">
                    <option value="">Select a game</option>
                    {games.map((game) => (
                      <option key={game.id} value={game.id}>{game.title}</option>
                    ))}
                  </select>
                </Field>
                <div className="flex flex-col justify-end gap-3">
                  <button type="button" onClick={createWishlist} disabled={busy} className="secondary-button">Create list</button>
                  <button type="button" onClick={purchaseGame} disabled={busy || selectedGameOwned} className="primary-button disabled:cursor-not-allowed disabled:opacity-60">
                    {selectedGameOwned ? 'Already owned' : 'Buy selected game'}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-emerald-400/10 bg-emerald-400/5 p-4">
                <div className="flex items-center gap-2">
                  <SectionBadge tone="wishlist">Wishlists</SectionBadge>
                  <IconStar />
                </div>
                <select value={selectedWishlistId} onChange={(event) => setSelectedWishlistId(event.target.value)} className="input-field select-field max-w-sm">
                    <option value="">Select list</option>
                  {wishlists.map((wishlist) => (
                    <option key={wishlist.id || wishlist.wishlistId || wishlist.name} value={wishlist.id || wishlist.wishlistId}>
                      {wishlist.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addGameToWishlist} className="secondary-button btn-ghost-animated">Save game to list</button>
                <button type="button" onClick={() => setSelectedWishlistId('')} className="secondary-button btn-ghost-animated text-warm">Clear selection</button>
              </div>
              <div className="grid gap-3">
                {wishlists.map((wishlist) => {
                  const wishlistId = wishlist.id || wishlist.wishlistId || wishlist.name;
                  const isSelected = String(selectedWishlistId) === String(wishlistId);
                  return (
                    <div key={wishlistId} className={`wishlist-card reveal-up rounded-3xl border p-4 transition ${isSelected ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-emerald-400/10 bg-black/20'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{wishlist.name}</div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{wishlist.gameTitles?.length || 0} games saved</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setSelectedWishlistId(wishlistId)} className="text-xs uppercase tracking-[0.2em] text-accent">Select</button>
                          <button type="button" onClick={() => removeWishlist(wishlistId)} className="text-xs uppercase tracking-[0.2em] text-warm">Delete</button>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-300">
                        {(wishlist.gameTitles || []).slice(0, 6).map((title) => (
                          <span key={title} className="rounded-full border border-white/10 bg-black/20 px-3 py-1">{title}</span>
                        ))}
                        {!(wishlist.gameTitles || []).length ? <span className="text-slate-400">No games yet. Add one from the dropdown above.</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>

          <Section title="Purchase history" subtitle="Review downloads and reopen games from the same place." toneClassName="border-sky-400/10 bg-sky-400/5">
            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <StatCard label="Recent purchases" value={userSummary.purchaseCount} helper="" />
              <StatCard label="Wishlist" value={userSummary.selectedWishlistName} helper="" />
            </div>
            <div className="space-y-3">
              {purchases.map((purchase, index) => (
                <div key={purchase.id || purchase.gameId || `${purchase.gameTitle || 'game'}-${purchase.purchaseDate || 'date'}-${index}`} className="rounded-3xl border border-sky-400/10 bg-sky-400/5 p-4 transition hover:border-sky-400/30 hover:bg-sky-400/10">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="font-semibold text-white">{purchase.gameTitle}</div>
                      <div className="mt-1 text-sm text-slate-400">Purchased by {purchase.username}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {purchase.gameId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => downloadGame(purchase.gameId, purchase.gameTitle)}
                            disabled={downloadState[purchase.gameId]}
                            className="primary-button px-4 py-2 text-xs"
                          >
                            {downloadState[purchase.gameId] ? 'Preparing download...' : 'Download again'}
                          </button>
                          <GameMetadataBadges gameId={purchase.gameId} purchaseDate={purchase.purchaseDate} />
                        </>
                      ) : null}
                      <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">{purchase.purchaseDate}</div>
                    </div>
                  </div>
                </div>
              ))}
              {!purchases.length ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-slate-400">
                  No purchases yet. Pick a game from the dropdown and buy it to populate this list.
                </div>
              ) : null}
            </div>
          </Section>
        </div>
      ) : null}

      {isDeveloper ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Developer studio" subtitle="Manage the games you publish." action={<MiniButton onClick={() => loadDeveloperData()}>Refresh</MiniButton>}>
            <div className="grid gap-4 md:grid-cols-2">
              {myGames.map((game) => (
                <div key={game.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="font-semibold text-white">{game.title}</div>
                  <div className="mt-1 text-sm text-slate-400">{game.genre} • {game.platform}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">Developed by {game.developer || 'Unknown'}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MiniButton onClick={() => setSelectedGameId(game.id)}>Select</MiniButton>
                    <MiniButton onClick={() => deleteGame(game.id)}>Delete</MiniButton>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Create / update game" subtitle="Edit details, upload assets, and publish.">
            <div className="grid gap-4 lg:grid-cols-2">
              {Object.entries(gameForm).map(([key, value]) => {
                // Skip auto-managed and file-related fields
                if (key === 'imageUrl' || key === 'gameFileUrl' || key === 'galleryImageUrls' || key === 'sizeInBytes') {
                  return null;
                }
                // Textarea for longer text
                if (key === 'description' || key === 'systemRequirements') {
                  return (
                    <Field key={key} label={key === 'description' ? 'Description' : 'System Requirements'}>
                      <textarea name={key} value={value} onChange={updateForm(setGameForm)} rows="3" className="input-field" placeholder={key === 'description' ? 'Describe your game...' : 'e.g., Windows 10+, 8GB RAM'} />
                    </Field>
                  );
                }
                // Date input for release date
                if (key === 'releaseDate') {
                  return (
                    <Field key={key} label="Release Date">
                      <input name={key} value={value} onChange={updateForm(setGameForm)} className="input-field" type="date" />
                    </Field>
                  );
                }
                // Number inputs for price
                if (key === 'price') {
                  return (
                    <Field key={key} label="Price ($)">
                      <input name={key} value={value} onChange={updateForm(setGameForm)} className="input-field" type="number" step="0.01" min="0" placeholder="0.00" />
                    </Field>
                  );
                }
                // Regular text inputs
                const labels = {
                  title: 'Game Title',
                  developer: 'Developed By',
                  genre: 'Genre',
                  version: 'Version',
                  platform: 'Platform (Windows/macOS/Linux)',
                  ageRating: 'Age Rating (e.g., PEGI 12)'
                };
                if (key === 'developer') {
                  return (
                    <Field key={key} label={labels[key] || key}>
                      <input
                        name={key}
                        value={value || user?.username || profileName || ''}
                        onChange={updateForm(setGameForm)}
                        className="input-field"
                        type="text"
                        readOnly
                      />
                    </Field>
                  );
                }
                // Render a select for genre to keep options consistent
                if (key === 'genre') {
                  return (
                    <Field key={key} label={labels[key] || key}>
                      <PrettySelect
                        options={["", ...gamingGenres]}
                        value={value}
                        onChange={(v) => setGameForm((c) => ({ ...c, genre: v }))}
                        placeholder="Select a genre"
                      />
                    </Field>
                  );
                }

                return (
                  <Field key={key} label={labels[key] || key}>
                    <input name={key} value={value} onChange={updateForm(setGameForm)} className="input-field" type="text" placeholder={key === 'title' ? 'Enter game title...' : ''} />
                  </Field>
                );
              })}
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-400">File uploads</div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <label className="block">
                  <span className="label-text">Logo / cover image</span>
                  <input type="file" accept="image/*" onChange={handleLogoFile} className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-xs file:font-semibold file:text-ink" />
                  <div className="mt-2 text-xs text-slate-400">{logoFileName || 'No image chosen'}</div>
                </label>
                <label className="block">
                  <span className="label-text">Game file</span>
                  <input type="file" accept=".apk,.exe" onChange={handleGameFile} className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-xs file:font-semibold file:text-ink" />
                  <div className="mt-2 text-xs text-slate-400">{gameFileName || 'No file chosen'}</div>
                </label>
                <label className="block">
                  <span className="label-text">Game screenshots</span>
                  <input type="file" accept="image/*" multiple onChange={handleGalleryFiles} className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-accent file:px-4 file:py-2 file:text-xs file:font-semibold file:text-ink" />
                  <div className="mt-2 text-xs text-slate-400">{galleryFileNames.length ? galleryFileNames.join(', ') : 'You can choose multiple images'}</div>
                </label>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => createGame(gamePayload)} disabled={busy} className="primary-button">Create game</button>
              <button type="button" onClick={() => updateGame(selectedGameId, gamePayload)} disabled={busy} className="secondary-button">Update selected</button>
              <button type="button" onClick={() => deleteGame(selectedGameId)} disabled={busy} className="secondary-button text-warm">Delete selected</button>
            </div>
          </Section>
        </div>
      ) : null}

      {isAdmin ? (
        <div className="space-y-6">
          <Section title="Admin control tower" subtitle="Admin access is limited to deleting users and games." action={<MiniButton onClick={() => loadAdminData()}>Refresh</MiniButton>}>
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Users</div>
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{filteredAdminUsers.length} shown</div>
                  </div>
                  <div className="mt-3">
                    <input
                      value={adminUserSearch}
                      onChange={(event) => setAdminUserSearch(event.target.value)}
                      className="input-field"
                      placeholder="Search users by name, email, or role"
                    />
                  </div>
                  <div className="mt-3 max-h-72 space-y-2 overflow-auto pr-1">
                    {filteredAdminUsers.map((entry) => (
                      <div
                        key={entry.id || entry.username}
                        className="block w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-left transition hover:border-white/25"
                      >
                        <div className="font-semibold text-white">{entry.username}</div>
                        <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{entry.role}</div>
                        <div className="mt-3 flex gap-2">
                          <MiniButton onClick={() => deleteUser(entry.id)} className="text-warm">Delete</MiniButton>
                        </div>
                      </div>
                    ))}
                    {!filteredAdminUsers.length ? (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-slate-400">
                        No users matched your search.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Games</div>
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{filteredAdminGames.length} shown</div>
                  </div>
                  <div className="mt-3">
                    <input
                      value={adminGameSearch}
                      onChange={(event) => setAdminGameSearch(event.target.value)}
                      className="input-field"
                      placeholder="Search games by title, genre, platform, or developer"
                    />
                  </div>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    {filteredAdminGames.map((game) => (
                    <div key={game.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="font-semibold text-white">{game.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{game.genre} • {game.platform}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <MiniButton onClick={() => deleteGame(game.id, true)}>Delete</MiniButton>
                      </div>
                    </div>
                    ))}
                    {!filteredAdminGames.length ? (
                      <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5 text-sm text-slate-400 md:col-span-2">
                        No games matched your search.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>
      ) : null}

      {busy ? <div className="text-center text-sm text-slate-400">Working...</div> : null}
    </div>
  );
}