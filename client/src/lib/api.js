const API_ROOT = '/api';
const GLOBAL_API_ROOT = import.meta.env.VITE_API_ROOT ? import.meta.env.VITE_API_ROOT.replace(/\/api\/?$/, '') : null;

function makeRoot(specificEnvKey, localDefault) {
  if (GLOBAL_API_ROOT) return `${GLOBAL_API_ROOT}/api`;
  return import.meta.env[specificEnvKey] || localDefault;
}

const AUTH_API_ROOT = makeRoot('VITE_AUTH_API_ROOT', 'http://localhost:8087/api');
const GAME_API_ROOT = makeRoot('VITE_GAME_API_ROOT', 'http://localhost:8082/api');
const STORAGE_API_ROOT = makeRoot('VITE_STORAGE_API_ROOT', 'http://localhost:8085/api');
const PURCHASE_API_ROOT = makeRoot('VITE_PURCHASE_API_ROOT', 'http://localhost:8083/api');
const WISHLIST_API_ROOT = makeRoot('VITE_WISHLIST_API_ROOT', 'http://localhost:8084/api');
const TOKEN_KEY = 'gameSpotlightToken';
const STORAGE_ORIGIN = STORAGE_API_ROOT.replace(/\/api\/?$/, '');

async function parseResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractMessage(payload, fallback) {
  if (typeof payload === 'string') {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    if (typeof payload.message === 'string') {
      return payload.message;
    }
    if (typeof payload.error === 'string') {
      return payload.error;
    }
    return JSON.stringify(payload);
  }
  return fallback;
}

function normalizeStorageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/api/storage/')) {
    return `${STORAGE_ORIGIN}${value}`;
  }

  return value;
}

function normalizeGame(game) {
  if (!game || typeof game !== 'object') {
    return game;
  }

  return {
    ...game,
    imageUrl: normalizeStorageUrl(game.imageUrl),
    gameFileUrl: normalizeStorageUrl(game.gameFileUrl),
    galleryImageUrls: Array.isArray(game.galleryImageUrls)
      ? game.galleryImageUrls.map(normalizeStorageUrl)
      : game.galleryImageUrls
  };
}

function normalizeGames(payload) {
  if (Array.isArray(payload)) {
    return payload.map(normalizeGame);
  }
  return normalizeGame(payload);
}

function hasAppToken() {
  return Boolean(localStorage.getItem(TOKEN_KEY));
}

export async function request(path, options = {}) {
  const { body, headers = {}, ...rest } = options;
  const finalHeaders = { ...headers };
  let finalBody = body;

  const token = localStorage.getItem(TOKEN_KEY);
  if (token && !finalHeaders.Authorization) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
    finalBody = JSON.stringify(body);
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    credentials: 'include',
    ...rest,
    headers: finalHeaders,
    body: finalBody
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    if ([401, 403].includes(response.status) && hasAppToken()) {
      storeAuthToken(null);
    }
    const error = new Error(extractMessage(payload, response.statusText));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function downloadFile(url, fileName, onProgress = null, expectedSizeBytes = null) {
  return new Promise((resolve, reject) => {
    try {
      if (onProgress) {
        onProgress(0);
      }

      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      // Public Supabase object URLs must be fetched without credentials,
      // otherwise the browser rejects wildcard CORS responses.
      xhr.responseType = 'blob';

      xhr.onprogress = (event) => {
        if (!onProgress) {
          return;
        }

        // Prefer actual transfer total from network, fall back to known game file size.
        const total = event.lengthComputable && event.total > 0
          ? event.total
          : Number(expectedSizeBytes) > 0
            ? Number(expectedSizeBytes)
            : null;

        if (total) {
          const progress = Math.min(99, Math.round((event.loaded / total) * 100));
          onProgress(progress);
          return;
        }

        // Unknown total size: keep progress moving based on bytes received.
        const pseudoProgress = Math.min(95, Math.max(1, Math.floor(Math.log10(event.loaded + 1) * 14)));
        onProgress(pseudoProgress);
      };

      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300 || !xhr.response) {
          reject(new Error(`Download failed (${xhr.status})`));
          return;
        }

        const objectUrl = URL.createObjectURL(xhr.response);
        try {
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = fileName || '';
          link.rel = 'noopener';
          document.body.appendChild(link);
          link.click();
          link.remove();

          if (onProgress) {
            onProgress(100);
          }
          resolve();
        } finally {
          setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error while downloading file.'));
      };

      xhr.send();
    } catch (error) {
      reject(error);
    }
  }).catch((error) => {
    if (onProgress) {
      onProgress(-1);
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    throw error;
  });
}

async function requestWithRoot(root, path, options = {}) {
  const { body, headers = {}, ...rest } = options;
  const finalHeaders = { ...headers };
  let finalBody = body;

  const token = localStorage.getItem(TOKEN_KEY);
  if (token && !finalHeaders.Authorization) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    finalHeaders['Content-Type'] = finalHeaders['Content-Type'] || 'application/json';
    finalBody = JSON.stringify(body);
  }

  const response = await fetch(`${root}${path}`, {
    credentials: 'include',
    ...rest,
    headers: finalHeaders,
    body: finalBody
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    if ([401, 403].includes(response.status) && hasAppToken()) {
      storeAuthToken(null);
    }
    const error = new Error(extractMessage(payload, response.statusText));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export const api = {
  auth: {
    register: (payload) => requestWithRoot(AUTH_API_ROOT, '/auth/register', { method: 'POST', body: payload }),
    login: (payload) => requestWithRoot(AUTH_API_ROOT, '/auth/login', { method: 'POST', body: payload }),
    becomeDeveloper: () => requestWithRoot(AUTH_API_ROOT, '/auth/developer', { method: 'POST' }),
    logout: () => requestWithRoot(AUTH_API_ROOT, '/auth/logout', { method: 'POST' }),
    session: () => requestWithRoot(AUTH_API_ROOT, '/auth/session'),
    supabaseExchange: (accessToken, wantsDeveloper = false) => requestWithRoot(AUTH_API_ROOT, '/auth/oauth', {
      method: 'POST',
      body: { accessToken, wantsDeveloper }
    })
  },
  games: {
    all: async () => normalizeGames(await requestWithRoot(GAME_API_ROOT, '/games')),
    allPaginated: async (page = 1) => {
      const response = await requestWithRoot(GAME_API_ROOT, `/games/paginated?page=${page}`);
      return {
        ...response,
        content: normalizeGames(response.content || [])
      };
    },
    byId: async (gameId) => normalizeGame(await requestWithRoot(GAME_API_ROOT, `/games/${gameId}`)),
    addReview: async (gameId, payload) => normalizeGame(await requestWithRoot(GAME_API_ROOT, `/games/${gameId}/reviews`, { method: 'POST', body: payload })),
    deleteReview: async (gameId) => normalizeGame(await requestWithRoot(GAME_API_ROOT, `/games/${gameId}/reviews`, { method: 'DELETE' })),
    search: async (title) => normalizeGames(await requestWithRoot(GAME_API_ROOT, `/games/search?title=${encodeURIComponent(title)}`)),
    semanticSearch: async (query) => normalizeGames(await requestWithRoot(GAME_API_ROOT, `/games/semantic-search?query=${encodeURIComponent(query)}`)),
    suggestions: async (query, limit = 8) => requestWithRoot(GAME_API_ROOT, `/games/suggestions?query=${encodeURIComponent(query)}&limit=${limit}`),
    similar: async (gameId) => normalizeGames(await requestWithRoot(GAME_API_ROOT, `/games/${gameId}/similar`)),
    searchPaginated: async (title, page = 1) => {
      const response = await requestWithRoot(GAME_API_ROOT, `/games/search/paginated?title=${encodeURIComponent(title)}&page=${page}`);
      return {
        ...response,
        content: normalizeGames(response.content || [])
      };
    },
    semanticSearchPaginated: async (query, page = 1) => {
      const response = await requestWithRoot(GAME_API_ROOT, `/games/semantic-search/paginated?query=${encodeURIComponent(query)}&page=${page}`);
      return {
        ...response,
        content: normalizeGames(response.content || [])
      };
    },
    genre: async (genre) => normalizeGames(await requestWithRoot(GAME_API_ROOT, `/games/genre/${encodeURIComponent(genre)}`)),
    genrePaginated: async (genre, page = 1) => {
      const response = await requestWithRoot(GAME_API_ROOT, `/games/genre/${encodeURIComponent(genre)}/paginated?page=${page}`);
      return {
        ...response,
        content: normalizeGames(response.content || [])
      };
    },
    price: (min, max) => {
      const params = new URLSearchParams();
      if (min !== undefined && min !== null && min !== '') params.set('min', min);
      if (max !== undefined && max !== null && max !== '') params.set('max', max);
      return requestWithRoot(GAME_API_ROOT, `/games/price?${params.toString()}`).then(normalizeGames);
    },
    pricePaginated: async (min, max, page = 1) => {
      const params = new URLSearchParams();
      if (min !== undefined && min !== null && min !== '') params.set('min', min);
      if (max !== undefined && max !== null && max !== '') params.set('max', max);
      params.set('page', page);
      const response = await requestWithRoot(GAME_API_ROOT, `/games/price/paginated?${params.toString()}`);
      return {
        ...response,
        content: normalizeGames(response.content || [])
      };
    },
    filter: ({ title, genre, minPrice, maxPrice }) => {
      const params = new URLSearchParams();
      if (title) params.set('title', title);
      if (genre) params.set('genre', genre);
      if (minPrice !== undefined && minPrice !== null && minPrice !== '') params.set('minPrice', minPrice);
      if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') params.set('maxPrice', maxPrice);
      return requestWithRoot(GAME_API_ROOT, `/games/filter?${params.toString()}`).then(normalizeGames);
    },
    filterPaginated: async ({ title, genre, minPrice, maxPrice, page = 1 }) => {
      const params = new URLSearchParams();
      if (title) params.set('title', title);
      if (genre) params.set('genre', genre);
      if (minPrice !== undefined && minPrice !== null && minPrice !== '') params.set('minPrice', minPrice);
      if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') params.set('maxPrice', maxPrice);
      params.set('page', page);
      const response = await requestWithRoot(GAME_API_ROOT, `/games/filter/paginated?${params.toString()}`);
      return {
        ...response,
        content: normalizeGames(response.content || [])
      };
    }
  },
  user: {
    profile: () => requestWithRoot(AUTH_API_ROOT, '/auth/session'),
    updateProfile: (username) => requestWithRoot(AUTH_API_ROOT, '/user/profile', { method: 'PUT', body: new URLSearchParams({ username }).toString(), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
    changePassword: (payload) => requestWithRoot(AUTH_API_ROOT, '/user/password', { method: 'POST', body: payload }),
    purchases: () => requestWithRoot(PURCHASE_API_ROOT, '/purchases/user/me'),
    purchaseGame: (gameId) => requestWithRoot(PURCHASE_API_ROOT, '/purchases', {
      method: 'POST',
      body: { gameId },
      headers: {
        'Idempotency-Key': (typeof crypto !== 'undefined' && crypto.randomUUID)
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`
      }
    }),
    getGameDownloadUrl: async (gameId) => {
      const payload = await requestWithRoot(GAME_API_ROOT, `/games/${gameId}/download-url`);
      if (payload && typeof payload === 'object' && payload.url) {
        return { ...payload, url: normalizeStorageUrl(payload.url) };
      }
      return payload;
    },
    wishlistList: () => {
      if (!hasAppToken()) {
        return Promise.resolve([]);
      }
      return requestWithRoot(WISHLIST_API_ROOT, '/user/wishlist');
    },
    wishlistCreate: (name) => {
      if (!hasAppToken()) {
        return Promise.reject(new Error('Sign in to manage wishlists.'));
      }
      return requestWithRoot(WISHLIST_API_ROOT, `/user/wishlist/create?name=${encodeURIComponent(name)}`, { method: 'POST' });
    },
    wishlistById: (wishlistId) => requestWithRoot(WISHLIST_API_ROOT, `/user/wishlist/${wishlistId}`),
    wishlistDelete: (wishlistId) => {
      if (!hasAppToken()) {
        return Promise.reject(new Error('Sign in to manage wishlists.'));
      }
      return requestWithRoot(WISHLIST_API_ROOT, `/user/wishlist/${wishlistId}`, { method: 'DELETE' });
    },
    wishlistAdd: (wishlistId, gameId) => {
      if (!hasAppToken()) {
        return Promise.reject(new Error('Sign in to manage wishlists.'));
      }
      return requestWithRoot(WISHLIST_API_ROOT, `/user/wishlist/${wishlistId}/add/${gameId}`, { method: 'POST' });
    },
    wishlistRemove: (wishlistId, gameId) => requestWithRoot(WISHLIST_API_ROOT, `/user/wishlist/${wishlistId}/remove/${gameId}`, { method: 'DELETE' }),
    wishlistUpdate: (wishlistId, oldGameId, newGameId) => requestWithRoot(WISHLIST_API_ROOT, `/user/wishlist/${wishlistId}/update/${oldGameId}/${newGameId}`, { method: 'PUT' })
  },
  developer: {
    profile: () => requestWithRoot(AUTH_API_ROOT, '/auth/session'),
    games: async (developerUsername) => normalizeGames(await requestWithRoot(GAME_API_ROOT, `/games/developer/${encodeURIComponent(developerUsername || '')}`)),
    createGame: (payload) => requestWithRoot(GAME_API_ROOT, '/games', { method: 'POST', body: payload }),
    updateGame: (gameId, payload) => requestWithRoot(GAME_API_ROOT, `/games/${gameId}`, { method: 'PUT', body: payload }),
    deleteGame: (gameId) => requestWithRoot(GAME_API_ROOT, `/games/${gameId}`, { method: 'DELETE' })
  },
  storage: {
    uploadFile: (file, uploadedBy) => {
      const formData = new FormData();
      formData.append('file', file);
      if (uploadedBy) {
        formData.append('uploadedBy', uploadedBy);
      }
      return requestWithRoot(STORAGE_API_ROOT, '/storage/upload', { method: 'POST', body: formData });
    }
  },
  admin: {
    profile: () => requestWithRoot(AUTH_API_ROOT, '/auth/session'),
    users: () => requestWithRoot(AUTH_API_ROOT, '/users'),
    games: async () => normalizeGames(await requestWithRoot(GAME_API_ROOT, '/games')),
    purchases: () => requestWithRoot(PURCHASE_API_ROOT, '/purchases'),
    createUser: (payload) => requestWithRoot(AUTH_API_ROOT, '/users', { method: 'POST', body: payload }),
    updateUser: (userId, payload) => requestWithRoot(AUTH_API_ROOT, `/users/${userId}`, { method: 'PUT', body: payload }),
    deleteUser: (userId) => requestWithRoot(AUTH_API_ROOT, `/users/${userId}`, { method: 'DELETE' }),
    createGame: (payload) => requestWithRoot(GAME_API_ROOT, '/games', { method: 'POST', body: payload }),
    updateGame: (gameId, payload) => requestWithRoot(GAME_API_ROOT, `/games/${gameId}`, { method: 'PUT', body: payload }),
    deleteGame: (gameId) => requestWithRoot(GAME_API_ROOT, `/games/${gameId}`, { method: 'DELETE' })
  }
};

export function storeAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}
