import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { X } from 'lucide-react';
import './styles.css';
import { api, defaultSiteSettings, getRoute } from './utils';
import { PublicHeader, PublicFooter } from './components/PublicLayout';
import { HomePage } from './components/HomePage';
import { ServerRentPage } from './components/ServerRentPage';
import { ClientPortal } from './components/ClientPortal';
import { AdminPortal } from './components/AdminPortal';

function Redirect({ to, navigate }) {
  React.useEffect(() => { navigate(to); }, [to, navigate]);
  return null;
}

function App() {
  const [route, setRoute] = useState(getRoute);
  const [mobileNav, setMobileNav] = useState(false);
  const [products, setProducts] = useState([]);
  const [siteSettings, setSiteSettings] = useState(defaultSiteSettings);
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [notice, setNotice] = useState('');

  const routePath = route.split('?')[0];
  const isAdmin = routePath.startsWith('/admin');

  const navigate = (nextRoute) => {
    window.history.pushState(null, '', nextRoute);
    setRoute(getRoute());
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refreshProducts = async () => setProducts(await api('/api/products'));
  const refreshSiteSettings = async () => setSiteSettings({ ...defaultSiteSettings, ...(await api('/api/site-settings')) });
  const refreshUser = async () => {
    try {
      setUser(await api('/api/auth/me'));
    } catch {
      setUser(null);
    }
  };
  const refreshAdmin = async () => {
    try {
      setAdmin(await api('/api/admin/auth/me'));
    } catch {
      setAdmin(null);
    }
  };

  useEffect(() => {
    const onRoute = () => setRoute(getRoute());
    window.addEventListener('hashchange', onRoute);
    window.addEventListener('popstate', onRoute);
    return () => {
      window.removeEventListener('hashchange', onRoute);
      window.removeEventListener('popstate', onRoute);
    };
  }, []);

  useEffect(() => {
    refreshSiteSettings().catch((error) => setNotice(error.message));
    refreshProducts().catch((error) => setNotice(error.message));
    if (isAdmin) refreshAdmin();
    else refreshUser();
  }, [isAdmin]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (routePath === '/login/impersonate') {
      const token = new URLSearchParams(route.split('?')[1] || '').get('token');
      if (token) {
        api('/api/auth/impersonate', { method: 'POST', body: { token } })
          .then((nextUser) => {
            setUser(nextUser);
            navigate('/client');
          })
          .catch((error) => setNotice(error.message));
      }
    }
  }, [route]);

  const shared = {
    admin,
    api,
    navigate,
    notice,
    products,
    refreshAdmin,
    refreshProducts,
    refreshSiteSettings,
    refreshUser,
    route,
    routePath,
    setAdmin,
    setNotice,
    setUser,
    siteSettings,
    user
  };

  return (
    <div className={isAdmin ? 'app admin-shell-bg' : 'app'}>
      {!isAdmin && <PublicHeader mobileNav={mobileNav} setMobileNav={setMobileNav} {...shared} />}
      {notice && <div className="toast">{notice}<button onClick={() => setNotice('')}><X size={16} /></button></div>}
      {routePath === '/' && <HomePage {...shared} />}
      {(routePath === '/products' || routePath === '/buy') && <Redirect to="/servers" navigate={navigate} />}
      {routePath === '/servers' && <ServerRentPage {...shared} />}
      {routePath.startsWith('/client') && <ClientPortal {...shared} />}
      {isAdmin && <AdminPortal {...shared} />}
      {!isAdmin && <PublicFooter siteSettings={siteSettings} navigate={navigate} />}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
