import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export default function AuthPage() {
  const { user } = useAuth();
  const [wantsDeveloper, setWantsDeveloper] = useState(false);

  // Check if user is already a normal user (no longer eligible for developer promotion)
  const isNormalUser = user?.role === 'NORMAL_USER';
  const isDeveloper = user?.role === 'DEVELOPER';
  const isAdmin = user?.role === 'ADMIN';
  const canBecomeDeveloper = !isNormalUser && !isDeveloper && !isAdmin;
  const showSupabaseSetupWarning = !isSupabaseConfigured;

  const handleDeveloperChange = (e) => {
    if (!canBecomeDeveloper) return;
    
    const checked = e.target.checked;
    setWantsDeveloper(checked);
    if (checked) {
      localStorage.setItem('pendingDeveloperPromotion', 'true');
    } else {
      localStorage.removeItem('pendingDeveloperPromotion');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-accent/5 blur-3xl float-slow" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-accent-2/5 blur-3xl float-slower" />
        <div className="absolute top-1/3 right-1/4 h-60 w-60 rounded-full bg-warm/3 blur-3xl" />
      </div>

      {/* Main content container */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Branding section */}
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-gradient-to-r from-accent to-accent-2" />
              <span className="text-xs font-semibold text-white uppercase tracking-wide">Game Spotlight</span>
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Welcome Back
          </h1>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
            Sign in to discover, collect, and manage your game library across our platform
          </p>
        </div>

        {/* Auth card */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/8 to-white/3 backdrop-blur-xl p-8 sm:p-10 shadow-2xl mb-6">
          {/* Header inside card */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-2">Quick Sign In</h2>
            <p className="text-sm text-slate-400">Choose your preferred authentication method to get started</p>
          </div>

          {/* Auth providers */}
          <div className="space-y-4">
            {showSupabaseSetupWarning ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                Supabase login is not configured in this frontend session. Set <span className="font-semibold">VITE_SUPABASE_URL</span> and <span className="font-semibold">VITE_SUPABASE_ANON_KEY</span>, then restart the dev server.
              </div>
            ) : (
              <Auth
                supabaseClient={supabase}
                providers={['google', 'github']}
                socialLayout="vertical"
                magicLink={true}
                appearance={{
                  theme: ThemeSupa,
                  variables: {
                    default: {
                      colors: {
                        brand: '#26b7a8',
                        brandAccent: '#4f6ef5',
                        brandButtonText: '#ffffff',
                        defaultButtonBackground: '#ffffff/10',
                        defaultButtonBackgroundHover: '#ffffff/20',
                        defaultButtonBorder: '#ffffff/20',
                        defaultButtonText: '#ffffff',
                        dividerBackground: '#ffffff/10',
                        inputBackground: '#ffffff/5',
                        inputBorder: '#ffffff/10',
                        inputBorderFocus: '#26b7a8',
                        inputBorderHover: '#ffffff/20',
                        inputPlaceholder: '#94a3b8',
                        inputText: '#ffffff',
                        messageText: '#e2e8f0',
                        messageTextDanger: '#f87171',
                        messageBackground: '#1e293b',
                        messageBackgroundDanger: '#7f1d1d',
                      },
                      borderWidths: {
                        buttonBorderWidth: '1px',
                        inputBorderWidth: '1px',
                      },
                      radii: {
                        borderRadiusButton: '1rem',
                        buttonBorderRadius: '1rem',
                        inputBorderRadius: '1rem',
                      },
                    },
                  },
                }}
              />
            )}
          </div>

          {/* Divider with text */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-white/0 via-white/20 to-white/0" />
            <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Or continue with</span>
            <div className="flex-1 h-px bg-gradient-to-r from-white/0 via-white/20 to-white/0" />
          </div>

          {/* Magic link info */}
          <p className="text-xs text-slate-500 text-center leading-relaxed">
            We support passwordless sign-in via email magic links. Check your inbox after clicking the email button above.
          </p>

          {/* Developer checkbox */}
          {canBecomeDeveloper ? (
            <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl border border-accent/20 bg-accent/5">
              <input
                type="checkbox"
                id="developer-check"
                checked={wantsDeveloper}
                onChange={handleDeveloperChange}
                className="mt-1 w-4 h-4 rounded accent-accent cursor-pointer"
              />
              <label htmlFor="developer-check" className="cursor-pointer flex-1">
                <div className="text-sm font-semibold text-white">Register as Developer</div>
                <p className="text-xs text-slate-400 mt-1">Get access to publishing tools and developer workspace after sign-in</p>
              </label>
            </div>
          ) : isNormalUser ? (
            <div className="mt-6 flex items-start gap-3 p-4 rounded-2xl border border-slate-500/20 bg-slate-500/5">
              <div className="mt-1 w-4 h-4 rounded flex items-center justify-center flex-shrink-0">
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-400">Developer Role Locked</div>
                <p className="text-xs text-slate-500 mt-1">You registered as a normal user. This choice cannot be changed.</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Features info */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
            <div className="text-xl mb-2">🎮</div>
            <p className="text-xs font-semibold text-white">Explore Games</p>
            <p className="text-xs text-slate-500 mt-1">Browse our full catalog</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
            <div className="text-xl mb-2">⭐</div>
            <p className="text-xs font-semibold text-white">Save & Track</p>
            <p className="text-xs text-slate-500 mt-1">Create your wishlist</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center">
            <div className="text-xl mb-2">🔐</div>
            <p className="text-xs font-semibold text-white">Secure Account</p>
            <p className="text-xs text-slate-500 mt-1">OAuth protected</p>
          </div>
        </div>

        {/* Footer info */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 text-center text-xs text-slate-400">
          <p>We take your privacy seriously. Your session is securely managed by Supabase and our backend service.</p>
        </div>

        {/* Status indicator */}
        {user ? (
          <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-center">
            <p className="text-sm text-accent font-medium">✓ Signed in as {user.username}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}