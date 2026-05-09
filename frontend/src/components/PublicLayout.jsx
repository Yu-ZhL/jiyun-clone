import React from 'react';
import {
  Cloud,
  LogIn,
  LogOut,
  Menu,
  User,
  X
} from 'lucide-react';
import { hk, api } from '../utils';

export function PublicHeader({ navigate, routePath, user, mobileNav, setMobileNav, siteSettings, refreshUser, setNotice }) {
  const nav = [
    { label: '首頁', path: '/' },
    { label: '伺服器租用', path: '/servers' },
    { label: hk.navConsole, path: '/client' }
  ];
  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      await refreshUser();
      setNotice('已退出登录');
      navigate('/');
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <header className="site-header">
      <div className="topbar">
        <div className="container topbar-inner">
          <span>{siteSettings.support_phone}</span>
          <span>{siteSettings.support_email}</span>
          <button onClick={() => navigate('/client')}>控制台</button>
          <button onClick={() => navigate('/client/tickets')}>提交工單</button>
        </div>
      </div>
      <div className="container nav-row">
        <button className="brand" onClick={() => navigate('/')}>
          <span className="brand-mark"><Cloud size={24} /></span>
          <span><strong>{siteSettings.site_name.replace('主机管理系统', '').replace('主機管理系統', '') || '極雲'}</strong><small>主機管理系統</small></span>
        </button>
        <nav className={mobileNav ? 'nav-links open' : 'nav-links'}>
          {nav.map((item) => (
            <button key={item.path + item.label} className={routePath === item.path ? 'active' : ''} onClick={() => navigate(item.path)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="signed-in-user"><User size={15} /><small>已登录</small><strong>{user.username}</strong></span>
              <button className="text-btn" onClick={() => navigate('/client')}>客户中心</button>
              <button className="secondary small logout-btn" onClick={logout}><LogOut size={15} />退出</button>
            </>
          ) : (
            <>
              <button className="text-btn" onClick={() => navigate('/client?auth=login')}><LogIn size={16} />{hk.login}</button>
              <button className="primary small" onClick={() => navigate('/client?auth=register')}>{hk.register}</button>
            </>
          )}
          <button className="icon-btn mobile-only" aria-label="menu" onClick={() => setMobileNav((value) => !value)}>
            {mobileNav ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter({ siteSettings, navigate }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div><div className="footer-brand"><Cloud size={26} />{siteSettings.site_name}</div><p>專業互聯網基礎服務提供商，香港伺服器、美國伺服器及 VPS 服務商。</p></div>
        <div><h3>產品中心</h3><button className="footer-link" onClick={() => navigate('/servers')}>伺服器租用</button><a>伺服器託管</a></div>
        <div><h3>服務支援</h3><a>服務條款</a><a>私隱政策</a><button className="footer-link" onClick={() => navigate('/client/tickets')}>提交工單</button></div>
        <div><h3>聯絡我們</h3><p>中國·香港</p><p>{siteSettings.support_phone}</p><p>{siteSettings.support_email}</p></div>
      </div>
      <div className="copyright">{siteSettings.copyright}</div>
    </footer>
  );
}
