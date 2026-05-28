import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { prefetchRoute } from '../lib/routePrefetch';
import ProfileMenu from './ProfileMenu';
import Header from './Header';
import SearchBar from './SearchBar';

const baseNavItems = [
  { to: '/', label: 'Discover' },
  { to: '/catalog', label: 'Catalog' }
];

function NavButton({ to, children }) {
  const prefetchNavTarget = () => prefetchRoute(to);

  return (
    <NavLink
      to={to}
      onMouseEnter={prefetchNavTarget}
      onFocus={prefetchNavTarget}
      onTouchStart={prefetchNavTarget}
      className={({ isActive }) => [
        'nav-button',
        isActive ? 'active' : 'inactive'
      ].join(' ')}
    >
      {children}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { user, logout, bootstrapError, isDeveloper, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [didYouMean, setDidYouMean] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const searchBoxRef = useRef(null);

  const roleLabel = useMemo(() => user?.role?.replace('_', ' ') || 'GUEST', [user]);
  const navItems = useMemo(() => {
    if (user?.role === 'NORMAL_USER') {
      return [
        ...baseNavItems,
        { to: '/workspace/wishlist', label: 'Wishlist' },
        { to: '/workspace/purchases', label: 'Purchases' }
      ];
    }
    if (isDeveloper || isAdmin) {
      return [
        ...baseNavItems,
        { to: '/workspace/developer', label: 'DEVELOPER' }
      ];
    }
    return baseNavItems;
  }, [user?.role, isDeveloper, isAdmin]);


  useEffect(() => {
    const term = search.trim();
    if (!term) {
      setSuggestions([]);
      setDidYouMean('');
      setShowSuggestions(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        const result = await api.games.suggestions(term, 8);
        if (!cancelled) {
          const nextSuggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
          setSuggestions(nextSuggestions);
          setDidYouMean(typeof result?.didYouMean === 'string' ? result.didYouMean : '');
          setShowSuggestions(true);
        }
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          setDidYouMean('');
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    // Clear timeout and search immediately on enter/submit
    if (search.trim()) {
      navigate(`/catalog?aiQuery=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="app-shell bg-ink">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <div className="fixed inset-0 -z-10 bg-hero-grid" />
      <Header navItems={navItems} user={user} roleLabel={roleLabel} />
      <div className="site-container mx-auto flex items-center gap-2 overflow-x-auto px-4 pb-4 sm:px-6 md:hidden">
        {navItems.map((item) => (
          <NavButton key={item.to} to={item.to}>{item.label}</NavButton>
        ))}
        <NavButton to="/catalog">Search</NavButton>
        <NavButton to="/workspace/wishlist">Wishlist</NavButton>
        <NavButton to="/workspace/purchases">Purchases</NavButton>
      </div>

      <div ref={searchBoxRef} className="site-container px-4 pt-4 pb-2 hidden md:block">
        <SearchBar value={search} onChange={setSearch} showSuggestions={showSuggestions} setShowSuggestions={setShowSuggestions} suggestions={suggestions} didYouMean={didYouMean} loading={suggestionsLoading} />
      </div>

      {bootstrapError ? (
        <div className="border-b border-warm/30 bg-warm/10 px-4 py-3 text-center text-sm text-warm">
          Session notice: {bootstrapError}
        </div>
      ) : null}

      <main id="main-content" className="page-surface mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}