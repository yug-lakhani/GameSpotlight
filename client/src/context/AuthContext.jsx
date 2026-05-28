import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, storeAuthToken } from '../lib/api';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);
const APP_TOKEN_KEY = 'gameSpotlightToken';

// Simple logger that silences debug/info in production
const __isDev = import.meta.env.DEV;
const logger = {
  debug: (...args) => { if (__isDev) console.debug(...args); },
  info: (...args) => { if (__isDev) console.info(...args); },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args)
};

function isAuthServiceUnavailable(error) {
  const message = String(error?.message || '');
  return error?.name === 'TypeError' && /Failed to fetch|NetworkError|ERR_CONNECTION_REFUSED/i.test(message);
}

function isAuthSessionRejected(error) {
  return [401, 403].includes(error?.status);
}

function rankRole(role) {
  switch (role) {
    case 'ADMIN':
      return 3;
    case 'DEVELOPER':
      return 2;
    case 'NORMAL_USER':
      return 1;
    default:
      return 0;
  }
}

function normalizeUser(payload, fallbackRole, avatarUrl = null) {
  if (!payload) {
    return null;
  }

  const normalizeRole = (role) => {
    if (!role) {
      return role;
    }
    const upper = String(role).toUpperCase();
    return upper === 'USER' ? 'NORMAL_USER' : upper;
  };

  const pickPrimaryRole = (roles) => {
    if (!Array.isArray(roles) || roles.length === 0) {
      return undefined;
    }

    return [...roles]
      .map(normalizeRole)
      .sort((left, right) => rankRole(right) - rankRole(left))[0];
  };

  const normalizedRoles = Array.isArray(payload.roles) ? payload.roles.map(normalizeRole) : payload.roles;
  const primaryRole = pickPrimaryRole(payload.roles);

  return {
    id: payload.id,
    username: payload.username,
    email: payload.email,
    displayName: payload.displayName,
    avatarUrl: avatarUrl || null,
    roles: normalizedRoles,
    role: normalizeRole(payload.role || primaryRole || fallbackRole)
  };
}

async function loadSessionUser() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  const accessToken = session?.access_token;
  const avatarUrl = session?.user?.user_metadata?.avatar_url || null;
  const hasAppToken = Boolean(localStorage.getItem(APP_TOKEN_KEY));

  if (hasAppToken) {
    try {
      const profile = await api.auth.session();
      return normalizeUser(profile, undefined, avatarUrl);
    } catch (error) {
      if (isAuthSessionRejected(error)) {
        storeAuthToken(null);
        return null;
      }
      if (isAuthServiceUnavailable(error)) {
        return null;
      }
      logger.debug('[Auth] app session lookup failed, falling back to Supabase token exchange', error);
      storeAuthToken(null);
    }
  }

  if (accessToken) {
      if (lastSupabaseAccessTokenRef.current === accessToken) {
      return null;
    }

    try {
      logger.debug('[Auth] exchanging supabase access token, length=', String(accessToken).length);
      const wantsDeveloper = localStorage.getItem('pendingDeveloperPromotion') === 'true';
      const exchange = await api.auth.supabaseExchange(accessToken, wantsDeveloper);
      logger.debug('[Auth] supabaseExchange response=', exchange);
      lastSupabaseAccessTokenRef.current = accessToken;
      if (exchange?.token) {
        storeAuthToken(exchange.token);
      }
      return normalizeUser(exchange?.user, undefined, avatarUrl);
    } catch (err) {
      if (isAuthServiceUnavailable(err)) {
        return null;
      }
      logger.error('[Auth] supabaseExchange failed', err);
      lastSupabaseAccessTokenRef.current = accessToken;
      if (!hasAppToken && [400, 401, 403].includes(err?.status)) {
        await supabase.auth.signOut();
        storeAuthToken(null);
      }
      throw err;
    }
  }

  if (!hasAppToken) {
    return null;
  }

  try {
    const profile = await api.auth.session();
    return normalizeUser(profile);
  } catch (error) {
    storeAuthToken(null);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState('');
  const lastSupabaseAccessTokenRef = useRef('');

  const refreshSession = async () => {
    setLoading(true);
    setBootstrapError('');

    try {
      const profile = await loadSessionUser();
      if (profile) {
        setUser(profile);
        return profile;
      }

      setUser(null);
      return null;
    } catch (error) {
      setUser(null);
      setBootstrapError('');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const resolveSupabaseSession = async (session) => {
      const accessToken = session?.access_token;
      const avatarUrl = session?.user?.user_metadata?.avatar_url || null;

      if (!accessToken || typeof accessToken !== 'string' || accessToken.trim().length === 0) {
        return null;
      }

      if (lastSupabaseAccessTokenRef.current === accessToken) {
        return null;
      }

      try {
        const wantsDeveloper = localStorage.getItem('pendingDeveloperPromotion') === 'true';
        const exchange = await api.auth.supabaseExchange(accessToken.trim(), wantsDeveloper);
        lastSupabaseAccessTokenRef.current = accessToken;
        if (exchange?.token) {
          storeAuthToken(exchange.token);
        }

        const profile = normalizeUser(exchange?.user, undefined, avatarUrl);
        if (profile && !cancelled) {
          setUser(profile);
        }

        return profile;
      } catch (error) {
        lastSupabaseAccessTokenRef.current = accessToken;
        if (!cancelled) {
          setBootstrapError(error.message || 'Unable to complete Supabase sign-in.');
        }

        if ([400, 401, 403].includes(error?.status)) {
          await supabase.auth.signOut();
          storeAuthToken(null);
          if (!cancelled) {
            setUser(null);
            setBootstrapError('');
          }
          return null;
        }

        throw error;
      }
    };

    const syncSession = async (event, session) => {
      if (event === 'SIGNED_OUT') {
        storeAuthToken(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const accessToken = session?.access_token;
      const hasAppToken = Boolean(localStorage.getItem(APP_TOKEN_KEY));

      if (hasAppToken) {
        try {
          const profile = await api.auth.session();
          const avatarUrl = session?.user?.user_metadata?.avatar_url || null;
          const nextUser = normalizeUser(profile, undefined, avatarUrl);
          if (nextUser) {
            setUser(nextUser);
          }
        } catch (error) {
          if (isAuthSessionRejected(error)) {
            storeAuthToken(null);
            setUser(null);
          } else if (!isAuthServiceUnavailable(error)) {
            logger.error('[Auth] app session refresh failed', error);
          }
        } finally {
          setLoading(false);
        }
        return;
      }

      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      try {
        await resolveSupabaseSession(session);
      } catch (error) {
        if ([400, 401, 403].includes(error?.status)) {
          if (!cancelled) {
            setUser(null);
            setBootstrapError('');
          }
        } else if (!isAuthServiceUnavailable(error)) {
          logger.error('[Auth] Supabase session sync failed', error);
        }
      } finally {
        setLoading(false);
      }
    };

    refreshSession().catch(() => {});

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.access_token) {
        syncSession('SIGNED_IN', data.session).catch(() => {});
      }
    });

    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange((event, session) => {
      void syncSession(event, session);
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  // Handle pending developer promotion after successful login
  useEffect(() => {
    const handlePendingPromotion = async () => {
      if (!user) return;
      
      const pendingPromotion = localStorage.getItem('pendingDeveloperPromotion');
      if (!pendingPromotion) return;
      
      // Don't promote if already a developer or admin
      if (user.role === 'DEVELOPER' || user.role === 'ADMIN') {
        localStorage.removeItem('pendingDeveloperPromotion');
        return;
      }

      // Only attempt promotion once per signup
      const promotionAttempted = localStorage.getItem('promotionAttempted');
      if (promotionAttempted) {
        return;
      }

      try {
        localStorage.setItem('promotionAttempted', 'true');
        const response = await api.auth.becomeDeveloper();
        if (response?.token) {
          storeAuthToken(response.token);
        }
        const nextUser = normalizeUser(response?.user, undefined, user?.avatarUrl || null);
        if (nextUser) {
          setUser(nextUser);
        }
        localStorage.removeItem('pendingDeveloperPromotion');
      } catch (error) {
        logger.error('[Auth] Automatic developer promotion failed', error);
        // Don't clear pendingDeveloperPromotion on error, let it retry
        localStorage.removeItem('promotionAttempted');
      }
    };

    handlePendingPromotion();
  }, [user]);

  const login = async (provider) => {
    const redirectTo = `${window.location.origin}/auth`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });

    if (error) {
      throw error;
    }

    return { provider };
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      storeAuthToken(null);
      setUser(null);
      // Clear developer promotion flags on logout
      localStorage.removeItem('pendingDeveloperPromotion');
      localStorage.removeItem('promotionAttempted');
    }
  };

  const becomeDeveloper = async () => {
    const response = await api.auth.becomeDeveloper();
    if (response?.token) {
      storeAuthToken(response.token);
    }

    const nextUser = normalizeUser(response?.user, undefined, user?.avatarUrl || null);
    if (nextUser) {
      setUser(nextUser);
    }

    return response;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      bootstrapError,
      refreshSession,
      login,
      logout,
      becomeDeveloper,
      setUser,
      isAdmin: user?.role === 'ADMIN',
      isDeveloper: user?.role === 'DEVELOPER',
      isNormalUser: user?.role === 'NORMAL_USER'
    }),
    [user, loading, bootstrapError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}


