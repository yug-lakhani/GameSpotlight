import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';
import { pageLoaders, prefetchLikelyRoutes } from './lib/routePrefetch';

const AuthPage = lazy(pageLoaders.loadAuthPage);
const CatalogPage = lazy(pageLoaders.loadCatalogPage);
const GameDetailPage = lazy(pageLoaders.loadGameDetailPage);
const HomePage = lazy(pageLoaders.loadHomePage);
const NotFoundPage = lazy(pageLoaders.loadNotFoundPage);
const PurchasesPage = lazy(pageLoaders.loadPurchasesPage);
const WishlistPage = lazy(pageLoaders.loadWishlistPage);
const WorkspacePage = lazy(pageLoaders.loadWorkspacePage);

function WorkspaceRedirect() {
  const { user, loading, isNormalUser } = useAuth();

  if (loading) {
    return <div className="glass-panel p-8 text-center text-slate-300">Restoring your session...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (isNormalUser) {
    return <Navigate to="/workspace/wishlist" replace />;
  }

  return <Navigate to="/catalog" replace />;
}

function ProtectedNormalUserArea({ children }) {
  const { user, loading, isNormalUser } = useAuth();

  if (loading) {
    return <div className="glass-panel p-8 text-center text-slate-300">Restoring your session...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isNormalUser) {
    return <Navigate to="/catalog" replace />;
  }

  return children;
}

function ProtectedDeveloperArea({ children }) {
  const { user, loading, isDeveloper, isAdmin } = useAuth();

  if (loading) {
    return <div className="glass-panel p-8 text-center text-slate-300">Restoring your session...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isDeveloper && !isAdmin) {
    return <Navigate to="/catalog" replace />;
  }

  return children;
}

export default function App() {
  const { user, isNormalUser, isDeveloper, isAdmin } = useAuth();

  useEffect(() => {
    const prefetch = () => prefetchLikelyRoutes({ user, isNormalUser, isDeveloper, isAdmin });

    const idleCallback = window.requestIdleCallback;
    if (typeof idleCallback === 'function') {
      const idleId = idleCallback(prefetch, { timeout: 2500 });
      return () => window.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(prefetch, 600);
    return () => window.clearTimeout(timeoutId);
  }, [user, isNormalUser, isDeveloper, isAdmin]);

  return (
    <Layout>
      <Suspense fallback={<div className="glass-panel p-8 text-center text-slate-300">Loading page...</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/games/:gameId" element={<GameDetailPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/workspace" element={<WorkspaceRedirect />} />
          <Route path="/workspace/wishlist" element={<ProtectedNormalUserArea><WishlistPage /></ProtectedNormalUserArea>} />
          <Route path="/workspace/purchases" element={<ProtectedNormalUserArea><PurchasesPage /></ProtectedNormalUserArea>} />
          <Route path="/workspace/developer" element={<ProtectedDeveloperArea><WorkspacePage /></ProtectedDeveloperArea>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}