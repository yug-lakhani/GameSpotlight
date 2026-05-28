import React from 'react';
import { NavLink } from 'react-router-dom';
import ProfileMenu from './ProfileMenu';
import { prefetchRoute } from '../lib/routePrefetch';
import { Link } from 'react-router-dom';

function NavButton({ to, children }) {
  const prefetchNavTarget = () => prefetchRoute(to);
  return (
    <NavLink
      to={to}
      onMouseEnter={prefetchNavTarget}
      onFocus={prefetchNavTarget}
      onTouchStart={prefetchNavTarget}
      className={({ isActive }) => ['nav-button', isActive ? 'active' : 'inactive'].join(' ')}
    >
      {children}
    </NavLink>
  );
}

export default function Header({ navItems, user, roleLabel }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/80 backdrop-blur-2xl">
      <div className="site-container flex items-center gap-4 px-4 py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent2 text-sm font-black text-ink shadow-glow">
            GS
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-wide">GameSpotlight</div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Browse, save, buy, build</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-3 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavButton to={item.to} key={item.to}>{item.label}</NavButton>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300 sm:block">
            {roleLabel}
          </div>
          {user ? <ProfileMenu /> : (
            <Link
              to="/auth"
              onMouseEnter={() => prefetchRoute('/auth')}
              onFocus={() => prefetchRoute('/auth')}
              onTouchStart={() => prefetchRoute('/auth')}
              className="rounded-full bg-gradient-to-r from-accent to-accent2 px-4 py-2 text-sm font-semibold text-ink shadow-glow transition hover:brightness-110"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
