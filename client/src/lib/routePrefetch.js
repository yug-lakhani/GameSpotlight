const loadAuthPage = () => import('../pages/AuthPage');
const loadCatalogPage = () => import('../pages/CatalogPage');
const loadGameDetailPage = () => import('../pages/GameDetailPage');
const loadHomePage = () => import('../pages/HomePage');
const loadNotFoundPage = () => import('../pages/NotFoundPage');
const loadPurchasesPage = () => import('../pages/PurchasesPage');
const loadWishlistPage = () => import('../pages/WishlistPage');
const loadWorkspacePage = () => import('../pages/WorkspacePage');

const routeLoaderEntries = [
  ['/', loadHomePage],
  ['/catalog', loadCatalogPage],
  ['/games', loadGameDetailPage],
  ['/auth', loadAuthPage],
  ['/workspace/wishlist', loadWishlistPage],
  ['/workspace/purchases', loadPurchasesPage],
  ['/workspace/developer', loadWorkspacePage],
  ['*', loadNotFoundPage]
];

const routeLoaders = new Map(routeLoaderEntries);

export const pageLoaders = {
  loadAuthPage,
  loadCatalogPage,
  loadGameDetailPage,
  loadHomePage,
  loadNotFoundPage,
  loadPurchasesPage,
  loadWishlistPage,
  loadWorkspacePage
};

export function prefetchRoute(routePath) {
  if (!routePath || typeof routePath !== 'string') {
    return;
  }

  const normalized = routePath.startsWith('/games/') ? '/games' : routePath;
  const loader = routeLoaders.get(normalized);
  if (!loader) {
    return;
  }

  void loader().catch(() => null);
}

export function prefetchLikelyRoutes({ user, isNormalUser, isDeveloper, isAdmin }) {
  const sharedLoads = [loadCatalogPage, loadGameDetailPage, loadAuthPage];
  const normalUserLoads = [loadWishlistPage, loadPurchasesPage];
  const creatorLoads = [loadWorkspacePage];

  const tasks = [...sharedLoads];

  if (!user || isNormalUser) {
    tasks.push(...normalUserLoads);
  }

  if (isDeveloper || isAdmin) {
    tasks.push(...creatorLoads);
  }

  void Promise.all(tasks.map((loadPage) => loadPage().catch(() => null)));
}
