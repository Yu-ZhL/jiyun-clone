import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  Boxes,
  Check,
  CircleDollarSign,
  Cloud,
  CreditCard,
  Database,
  Globe2,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  Menu,
  PackagePlus,
  Plus,
  ReceiptText,
  Search,
  Server,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Ticket,
  User,
  Users,
  X,
  Zap
} from 'lucide-react';
import './styles.css';

const hk = {
  navHome: '首頁',
  navProducts: '產品中心',
  navBuy: '伺服器購買',
  navConsole: '控制台',
  navAdmin: '總後台',
  login: '登 錄',
  register: '註 冊',
  heroTitle: '香港伺服器',
  heroSub: 'T3+ 安全數據中心，BGP 國際多線 + 雙向 CN2 專線直連大陸，穩定、快速、性能卓越。',
  primaryCta: '立即購買',
  secondaryCta: '客戶控制台',
  why: '為甚麼選擇我們',
  productTitle: '多種伺服器產品',
  buyTitle: '選擇合適的伺服器方案',
  consoleTitle: '客戶後台',
  cartTitle: '確認訂單'
};

const defaultSiteSettings = {
  site_name: '極雲主機管理系統',
  support_phone: '800-800-8000',
  support_email: 'support@example.com',
  copyright: 'Copyright © 極雲主機管理系統',
  hero_title: hk.heroTitle,
  hero_subtitle: hk.heroSub
};

const emptyProductForm = {
  name: '',
  type: '云服务器',
  location: '中国香港',
  cpu: '',
  memory: '',
  disk: '',
  bandwidth: '',
  defense: '',
  priceMonthly: '',
  priceYearly: '',
  stock: '',
  description: ''
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({ code: response.status, message: '接口异常', data: null }));
  if (payload.code !== 0) throw new Error(payload.message || '请求失败');
  return payload.data;
}

function formatMoney(cents) {
  return `$${(Number(cents || 0) / 100).toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-HK', { hour12: false });
}

function getRoute() {
  const hashRoute = window.location.hash.replace(/^#/, '');
  if (hashRoute) return hashRoute;
  return `${window.location.pathname || '/'}${window.location.search || ''}`;
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
    refreshUser();
    refreshAdmin();
  }, []);

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
      {routePath === '/buy' && <BuyPage {...shared} />}
      {routePath.startsWith('/client') && <ClientPortal {...shared} />}
      {isAdmin && <AdminPortal {...shared} />}
      {!isAdmin && <PublicFooter siteSettings={siteSettings} />}
    </div>
  );
}

function PublicHeader({ navigate, routePath, user, mobileNav, setMobileNav, siteSettings }) {
  const nav = [
    { label: hk.navHome, path: '/' },
    { label: hk.navProducts, path: '/buy' },
    { label: hk.navBuy, path: '/buy' },
    { label: hk.navConsole, path: '/client' }
  ];
  return (
    <header className="site-header">
      <div className="topbar">
        <div className="container topbar-inner">
          <span>{siteSettings.support_phone}</span>
          <span>{siteSettings.support_email}</span>
          <button onClick={() => navigate('/client')}>控制台</button>
          <button onClick={() => navigate('/client')}>提交工單</button>
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
          <button onClick={() => navigate('/admin')} className="ghost-link">{hk.navAdmin}</button>
        </nav>
        <div className="nav-actions">
          <button className="text-btn" onClick={() => navigate('/client')}><LogIn size={16} />{user ? user.username : hk.login}</button>
          <button className="primary small" onClick={() => navigate(user ? '/buy' : '/client')}>{user ? hk.primaryCta : hk.register}</button>
          <button className="icon-btn mobile-only" aria-label="menu" onClick={() => setMobileNav((value) => !value)}>
            {mobileNav ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function HomePage({ products, navigate, siteSettings }) {
  const cards = [
    { icon: <Zap />, title: '領先的產品技術', text: '提供中小企業及個人用戶友好的雲伺服器、高防及託管服務。' },
    { icon: <ShieldCheck />, title: '安全防護', text: '基於智能清洗策略，為核心業務提供穩定可靠的防護能力。' },
    { icon: <Headphones />, title: '無憂售後服務', text: '7x24 小時技術支援，電話、工單、客服多種方式快速響應。' }
  ];
  return (
    <main>
      <section className="hero">
        <div className="hero-media" />
        <div className="container hero-content">
          <div className="hero-copy">
            <span className="eyebrow">Hong Kong IDC Service</span>
            <h1>{siteSettings.hero_title}</h1>
            <p>{siteSettings.hero_subtitle}</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => navigate('/buy')}>{hk.primaryCta}</button>
              <button className="secondary" onClick={() => navigate('/client')}>{hk.secondaryCta}</button>
            </div>
          </div>
          <div className="hero-panel">
            <div><span>在線節點</span><strong>{products.reduce((sum, product) => sum + product.stock, 0)}+</strong></div>
            <div><span>可售產品</span><strong>{products.length}</strong></div>
            <div><span>交付時間</span><strong>人工開通</strong></div>
          </div>
        </div>
      </section>
      <section className="container section">
        <div className="section-title"><span>Service</span><h2>{hk.why}</h2></div>
        <div className="why-grid">
          {cards.map((card) => <article className="feature-card" key={card.title}><div className="feature-icon">{card.icon}</div><h3>{card.title}</h3><p>{card.text}</p></article>)}
        </div>
      </section>
      <section className="product-band">
        <div className="container section">
          <div className="section-title"><span>Hosting Products</span><h2>{hk.productTitle}</h2></div>
          <ProductGrid products={products} navigate={navigate} />
        </div>
      </section>
      <section className="container split-section">
        <div className="server-photo" />
        <div className="split-copy">
          <span className="eyebrow">Powerful Platform</span>
          <h2>強大的伺服器和平台</h2>
          <p>採用多網融合技術、T3+ 數據中心和冗餘保護機制，協助企業拓展線上業務。</p>
          <div className="info-list">
            <div><ShieldCheck size={20} />防火牆安全防護</div>
            <div><Globe2 size={20} />遍佈全球可用區</div>
            <div><Zap size={20} />下單後後台开通交付</div>
          </div>
          <button className="primary" onClick={() => navigate('/buy')}>從這裏開始</button>
        </div>
      </section>
      <ServiceStrip />
    </main>
  );
}

function ProductGrid({ products, navigate }) {
  return (
    <div className="pricing-grid">
      {products.map((product) => (
        <article className="price-card" key={product.id}>
          <div className="price-image"><Server /></div>
          <span className="pill">{product.type}</span>
          <h3>{product.name}</h3>
          <p>{product.location} / {product.bandwidth}</p>
          <div className="price">起價 <strong>{formatMoney(product.priceMonthly)}</strong><span>/月</span></div>
          <ul>
            {[product.cpu, product.memory, product.disk, product.defense].map((item) => <li key={item}><Check size={16} />{item}</li>)}
          </ul>
          <button className="primary wide" onClick={() => navigate(`/buy?product=${product.id}`)}>購買</button>
        </article>
      ))}
    </div>
  );
}

function ServiceStrip() {
  const items = [
    ['雲伺服器', Cloud],
    ['伺服器租用', Server],
    ['伺服器託管', Database],
    ['域名註冊', Globe2],
    ['SSL 證書', LockKeyhole],
    ['解決方案', Boxes]
  ];
  return (
    <section className="service-strip">
      <div className="container service-grid">
        {items.map(([item, Icon], index) => (
          <article key={item}><div className="round-icon"><Icon /></div><h3>{item}</h3><p>{index < 3 ? '高速穩定、安全可靠，適合企業網站、電商及跨境業務。' : '一站式基礎服務，配合主機產品快速部署。'}</p></article>
        ))}
      </div>
    </section>
  );
}

function BuyPage({ products, user, navigate, setNotice }) {
  const params = new URLSearchParams(window.location.search || location.hash.split('?')[1] || '');
  const [productId, setProductId] = useState(params.get('product') || '');
  const [cycle, setCycle] = useState('monthly');
  const product = products.find((item) => item.id === productId) || products[0];

  useEffect(() => {
    if (!productId && products[0]) setProductId(products[0].id);
  }, [products, productId]);

  const createOrder = async () => {
    if (!user) {
      navigate('/client');
      return;
    }
    try {
      const order = await api('/api/orders', { method: 'POST', body: { productId: product.id, cycle } });
      setNotice(`订单 ${order.orderNo} 已创建`);
      navigate('/client');
    } catch (error) {
      setNotice(error.message);
    }
  };

  if (!product) return <main className="container section"><h1>暂无可售产品</h1></main>;

  return (
    <main className="buy-page">
      <section className="page-hero"><div className="container"><span className="eyebrow">Product Center</span><h1>{hk.buyTitle}</h1><p>產品、價格與庫存均來自後端 API，下單後可在客戶後台完成余额支付。</p></div></section>
      <section className="container buy-layout">
        <div className="catalog">
          <div className="toolbar">
            <div className="searchbox"><Search size={18} /><span>香港 / CN2 / 高防</span></div>
            <div className="segment">
              <button className={cycle === 'monthly' ? 'active' : ''} onClick={() => setCycle('monthly')}>月付</button>
              <button className={cycle === 'yearly' ? 'active' : ''} onClick={() => setCycle('yearly')}>年付</button>
            </div>
          </div>
          <div className="server-list">
            {products.map((item) => (
              <button key={item.id} className={item.id === product.id ? 'server-row selected' : 'server-row'} onClick={() => setProductId(item.id)}>
                <span><Server size={20} />{item.name}</span><span>{item.cpu}</span><span>库存 {item.stock}</span><strong>{formatMoney(cycle === 'yearly' ? item.priceYearly : item.priceMonthly)}</strong>
              </button>
            ))}
          </div>
        </div>
        <aside className="checkout">
          <h2>{hk.cartTitle}</h2>
          <dl>
            <div><dt>產品</dt><dd>{product.name}</dd></div>
            <div><dt>地區</dt><dd>{product.location}</dd></div>
            <div><dt>配置</dt><dd>{product.cpu} / {product.memory}</dd></div>
            <div><dt>週期</dt><dd>{cycle === 'yearly' ? '年付' : '月付'}</dd></div>
          </dl>
          <div className="total"><span>合計</span><strong>{formatMoney(cycle === 'yearly' ? product.priceYearly : product.priceMonthly)}</strong></div>
          <button className="primary wide" onClick={createOrder}><ShoppingCart size={18} />提交訂單</button>
          <p>{user ? '订单创建后可在客户后台选择余额支付。' : '請先登入或註冊客戶賬號。'}</p>
        </aside>
      </section>
    </main>
  );
}

function ClientPortal(props) {
  if (!props.user) return <AuthPage {...props} />;
  return <ClientDashboard {...props} />;
}

function AuthPage({ refreshUser, setNotice }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', account: '', password: '' });
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    try {
      if (mode === 'register') {
        await api('/api/auth/register', { method: 'POST', body: { username: form.username, email: form.email, password: form.password } });
      } else {
        await api('/api/auth/login', { method: 'POST', body: { account: form.account, password: form.password } });
      }
      await refreshUser();
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <main className="login-page client-login">
      <div className="login-visual"><div className="login-illustration"><Cloud size={72} /><h1>客户控制台</h1><p>真实账号登录后通过服务端 Cookie 保持会话</p></div></div>
      <form className="login-form-card" onSubmit={submit} autoComplete="off">
        <h2>{mode === 'login' ? '客户登录' : '客户注册'}</h2>
        <p>登录、注册和会话保持均由后端接口处理</p>
        {mode === 'register' ? (
          <>
            <label>用户名<input autoComplete="off" value={form.username} onChange={(event) => update('username', event.target.value)} required /></label>
            <label>邮箱<input autoComplete="off" value={form.email} onChange={(event) => update('email', event.target.value)} required /></label>
          </>
        ) : <label>账号<input autoComplete="off" value={form.account} onChange={(event) => update('account', event.target.value)} required /></label>}
        <label>密码<input autoComplete="new-password" type="password" value={form.password} onChange={(event) => update('password', event.target.value)} required /></label>
        <button className="primary wide" type="submit">{mode === 'login' ? '登 录' : '注 册'}</button>
        <div className="login-foot"><span>{mode === 'login' ? '没有账号？' : '已有账号？'}</span><button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? '注册' : '登录'}</button></div>
      </form>
    </main>
  );
}

function ClientDashboard({ user, navigate, setNotice, refreshUser }) {
  const [section, setSection] = useState('overview');
  const [data, setData] = useState({ summary: null, orders: [], servers: [], wallet: [], tickets: [], notifications: [] });
  const [ticket, setTicket] = useState({ title: '', content: '' });
  const clientMenu = [
    ['overview', LayoutDashboard, '总览'],
    ['servers', Server, '我的服务器'],
    ['orders', ReceiptText, '订单记录'],
    ['tickets', Ticket, '工单支持'],
    ['wallet', CreditCard, '财务中心'],
    ['notifications', Bell, '站内通知']
  ];

  const load = async () => {
    const [summary, orders, servers, wallet, tickets, notifications] = await Promise.all([
      api('/api/client/summary'),
      api('/api/client/orders'),
      api('/api/client/servers'),
      api('/api/client/wallet/transactions'),
      api('/api/client/tickets'),
      api('/api/client/notifications')
    ]);
    setData({ summary, orders, servers, wallet, tickets, notifications });
    await refreshUser();
  };

  useEffect(() => { load().catch((error) => setNotice(error.message)); }, []);

  const pay = async (orderId) => {
    try {
      await api(`/api/orders/${orderId}/pay-with-balance`, { method: 'POST' });
      setNotice('支付成功');
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const renew = async (serverId) => {
    try {
      const order = await api(`/api/client/servers/${serverId}/renew`, { method: 'POST', body: { cycle: 'monthly' } });
      setNotice(`续费订单 ${order.orderNo} 已创建`);
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const submitTicket = async (event) => {
    event.preventDefault();
    try {
      await api('/api/client/tickets', { method: 'POST', body: ticket });
      setTicket({ title: '', content: '' });
      setNotice('工单已提交');
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.reload();
  };

  return (
    <main className="client-shell">
      <aside className="client-sidebar">
        <div className="client-profile"><div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div><strong>{user.username}</strong><span>{user.email}</span><span>余额 {formatMoney(user.balance)}</span></div>
        {clientMenu.map(([key, Icon, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}><Icon size={18} />{label}</button>)}
        <button onClick={logout}>退出登录</button>
      </aside>
      <section className="client-content">
        <div className="dashboard-head"><div><span className="eyebrow">Client Console</span><h1>{hk.consoleTitle}</h1></div><button className="primary" onClick={() => navigate('/buy')}><Plus size={18} />購買伺服器</button></div>
        {section === 'overview' && (
          <>
            <div className="metric-grid">
              <Metric icon={<Server />} label="服务器" value={data.summary?.servers || 0} />
              <Metric icon={<ReceiptText />} label="订单" value={data.summary?.orders || 0} />
              <Metric icon={<CreditCard />} label="余额" value={formatMoney(user.balance)} />
              <Metric icon={<Bell />} label="未读通知" value={data.summary?.unreadNotifications || 0} />
            </div>
            <div className="two-col">
              <Panel title="最近订单"><Rows rows={data.orders.slice(0, 6).map((order) => ({ left: order.orderNo, mid: formatMoney(order.amount), right: order.payStatus, action: order.payStatus === 'unpaid' ? <button className="table-action" onClick={() => pay(order.id)}>余额支付</button> : null }))} /></Panel>
              <Panel title="最近通知"><Rows rows={data.notifications.slice(0, 6).map((item) => ({ left: item.title, mid: formatDate(item.createdAt), right: item.readAt ? '已读' : '未读' }))} /></Panel>
            </div>
          </>
        )}
        {section === 'servers' && <Panel title="我的服务器"><DataTable columns={['名称', 'IP', '系统', '登录', '到期时间', '状态', '操作']} rows={data.servers.map((server) => [server.name, server.ip, server.os, `${server.loginUser} / ${server.loginPassword}`, formatDate(server.expiresAt), server.status, <button className="table-action" onClick={() => renew(server.id)}>续费</button>])} /></Panel>}
        {section === 'orders' && <Panel title="订单记录"><DataTable columns={['订单号', '产品', '类型', '金额', '支付状态', '开通状态', '操作']} rows={data.orders.map((order) => [order.orderNo, order.product?.name || '-', order.type, formatMoney(order.amount), order.payStatus, order.provisionStatus, order.payStatus === 'unpaid' ? <button className="table-action" onClick={() => pay(order.id)}>余额支付</button> : '-'])} /></Panel>}
        {section === 'tickets' && (
          <div className="two-col">
            <Panel title="提交工单"><form className="admin-form ticket-form" onSubmit={submitTicket}><input placeholder="标题" value={ticket.title} onChange={(event) => setTicket((prev) => ({ ...prev, title: event.target.value }))} required /><input placeholder="内容" value={ticket.content} onChange={(event) => setTicket((prev) => ({ ...prev, content: event.target.value }))} required /><button className="primary" type="submit">提交</button></form></Panel>
            <Panel title="工单列表"><Rows rows={data.tickets.map((item) => ({ left: item.title, mid: formatDate(item.updatedAt), right: item.status }))} /></Panel>
          </div>
        )}
        {section === 'wallet' && <Panel title="余额流水"><Rows rows={data.wallet.map((item) => ({ left: item.remark || item.type, mid: formatMoney(item.amount), right: formatMoney(item.balanceAfter) }))} /></Panel>}
        {section === 'notifications' && <Panel title="站内通知"><Rows rows={data.notifications.map((item) => ({ left: item.title, mid: item.content, right: item.readAt ? '已读' : '未读' }))} /></Panel>}
      </section>
    </main>
  );
}

function AdminPortal(props) {
  if (!props.admin) return <AdminLogin {...props} />;
  return <AdminDashboard {...props} />;
}

function AdminLogin({ refreshAdmin, setNotice }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const submit = async (event) => {
    event.preventDefault();
    try {
      await api('/api/admin/auth/login', { method: 'POST', body: form });
      await refreshAdmin();
    } catch (error) {
      setNotice(error.message);
    }
  };
  return (
    <main className="login-page">
      <div className="login-visual"><div className="login-illustration"><Cloud size={72} /><h1>主机管理系统</h1><p>管理员账号由后端 seed 生成</p></div></div>
      <form className="login-form-card" onSubmit={submit} autoComplete="off">
        <h2>主机管理系统</h2><p>管理员中文后台，默认账号由 seed 创建</p>
        <label>账户<input autoComplete="off" value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} /></label>
        <label>密码<input autoComplete="new-password" type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} /></label>
        <button className="primary wide" type="submit">登 录</button>
      </form>
    </main>
  );
}

function AdminDashboard({ admin, navigate, refreshAdmin, setNotice, refreshProducts, refreshSiteSettings }) {
  const [section, setSection] = useState('dashboard');
  const [data, setData] = useState({ summary: {}, users: [], products: [], orders: [], servers: [], tickets: [], logs: [], settings: [] });
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [serverForm, setServerForm] = useState({ orderId: '', name: '', ip: '', os: 'Ubuntu 22.04', loginUser: 'root', loginPassword: '', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) });
  const [rechargeForm, setRechargeForm] = useState({ open: false, user: null, amount: '', remark: '' });
  const [replyForm, setReplyForm] = useState({ open: false, ticket: null, content: '' });
  const [settingsForm, setSettingsForm] = useState({});

  const load = async () => {
    const [summary, users, products, orders, servers, tickets, logs, settings] = await Promise.all([
      api('/api/admin/dashboard/summary'),
      api('/api/admin/users'),
      api('/api/admin/products'),
      api('/api/admin/orders'),
      api('/api/admin/servers'),
      api('/api/admin/tickets'),
      api('/api/admin/operation-logs'),
      api('/api/admin/settings')
    ]);
    setData({ summary, users, products, orders, servers, tickets, logs, settings });
  };

  useEffect(() => { load().catch((error) => setNotice(error.message)); }, []);
  useEffect(() => {
    setSettingsForm(Object.fromEntries(data.settings.map((item) => [item.key, item.value])));
  }, [data.settings]);

  const logout = async () => {
    await api('/api/admin/auth/logout', { method: 'POST' });
    await refreshAdmin();
  };

  const addProduct = async (event) => {
    event.preventDefault();
    try {
      await api('/api/admin/products', { method: 'POST', body: productForm });
      setProductForm(emptyProductForm);
      await load();
      await refreshProducts();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const updateProductStatus = async (product, status) => {
    try {
      await api(`/api/admin/products/${product.id}/${status === 'on_sale' ? 'on-sale' : 'off-sale'}`, { method: 'POST' });
      await load();
      await refreshProducts();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    try {
      await api('/api/admin/settings', { method: 'PUT', body: settingsForm });
      await load();
      await refreshSiteSettings();
      setNotice('系统配置已保存');
    } catch (error) {
      setNotice(error.message);
    }
  };

  const submitRecharge = async (event) => {
    event.preventDefault();
    if (!rechargeForm.user) return;
    try {
      await api(`/api/admin/users/${rechargeForm.user.id}/adjust-balance`, {
        method: 'POST',
        body: { amount: Number(rechargeForm.amount), remark: rechargeForm.remark || '后台手动充值' }
      });
      setRechargeForm({ open: false, user: null, amount: '', remark: '' });
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const markPaid = async (orderId) => {
    try {
      await api(`/api/admin/orders/${orderId}/mark-paid`, { method: 'POST' });
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const openServer = async (event) => {
    event.preventDefault();
    try {
      await api('/api/admin/servers', { method: 'POST', body: serverForm });
      setServerForm((prev) => ({ ...prev, name: '', ip: '', loginPassword: '' }));
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const impersonate = async (userId) => {
    const { token } = await api(`/api/admin/users/${userId}/impersonate`, { method: 'POST' });
    navigate(`/login/impersonate?token=${token}`);
  };

  const runJobs = async () => {
    const result = await api('/api/admin/jobs/run', { method: 'POST' });
    setNotice(`任务执行完成：${JSON.stringify(result)}`);
    await load();
  };

  const submitReply = async (event) => {
    event.preventDefault();
    if (!replyForm.ticket) return;
    try {
      await api(`/api/admin/tickets/${replyForm.ticket.id}/replies`, { method: 'POST', body: { content: replyForm.content } });
      setReplyForm({ open: false, ticket: null, content: '' });
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const pendingPaidOrders = data.orders.filter((order) => order.payStatus === 'paid' && order.provisionStatus !== 'opened' && order.type === 'new_server');

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><Cloud size={24} /><strong>主机管理系统</strong></div>
        {[
          ['dashboard', LayoutDashboard, '控制台'],
          ['servers', Server, '服务器管理'],
          ['products', Boxes, '产品管理'],
          ['orders', ReceiptText, '订单管理'],
          ['users', Users, '用户管理'],
          ['tickets', Ticket, '工单管理'],
          ['logs', Settings, '操作日志']
        ].map(([key, Icon, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}><Icon size={18} />{label}</button>)}
      </aside>
      <section className="admin-main">
        <div className="admin-top"><div className="admin-search"><Search size={17} />搜索菜单 / 订单 / 用户</div><button className="icon-btn"><Bell size={18} /></button><button className="admin-user" onClick={logout}><User size={17} />{admin.username}</button></div>
        {section === 'dashboard' && <AdminSummary summary={data.summary} runJobs={runJobs} />}
        {section === 'products' && <AdminProducts products={data.products} form={productForm} setForm={setProductForm} addProduct={addProduct} updateProductStatus={updateProductStatus} />}
        {section === 'orders' && <AdminOrders orders={data.orders} markPaid={markPaid} />}
        {section === 'servers' && <AdminServers servers={data.servers} orders={pendingPaidOrders} form={serverForm} setForm={setServerForm} openServer={openServer} />}
        {section === 'users' && <AdminUsers users={data.users} openRecharge={(user) => setRechargeForm({ open: true, user, amount: '', remark: '后台手动充值' })} impersonate={impersonate} />}
        {section === 'tickets' && <AdminTickets tickets={data.tickets} openReply={(ticket) => setReplyForm({ open: true, ticket, content: '' })} />}
        {section === 'logs' && <AdminLogs logs={data.logs} settings={data.settings} settingsForm={settingsForm} setSettingsForm={setSettingsForm} saveSettings={saveSettings} />}
        {rechargeForm.open && (
          <Modal title={`给 ${rechargeForm.user.username} 充值`} onClose={() => setRechargeForm({ open: false, user: null, amount: '', remark: '' })}>
            <form className="modal-form" onSubmit={submitRecharge}>
              <label>充值金额<input type="number" min="0.01" step="0.01" value={rechargeForm.amount} onChange={(event) => setRechargeForm((prev) => ({ ...prev, amount: event.target.value }))} required /></label>
              <label>备注<input value={rechargeForm.remark} onChange={(event) => setRechargeForm((prev) => ({ ...prev, remark: event.target.value }))} /></label>
              <button className="primary" type="submit">确认充值</button>
            </form>
          </Modal>
        )}
        {replyForm.open && (
          <Modal title={`回复工单：${replyForm.ticket.title}`} onClose={() => setReplyForm({ open: false, ticket: null, content: '' })}>
            <form className="modal-form" onSubmit={submitReply}>
              <label>回复内容<textarea value={replyForm.content} onChange={(event) => setReplyForm((prev) => ({ ...prev, content: event.target.value }))} required /></label>
              <button className="primary" type="submit">发送回复</button>
            </form>
          </Modal>
        )}
      </section>
    </main>
  );
}

function AdminSummary({ summary, runJobs }) {
  return (
    <div className="admin-page">
      <div className="dashboard-head"><h1>控制台</h1><button className="primary" onClick={runJobs}>运行定时任务</button></div>
      <div className="admin-metrics">
        <Metric icon={<Users />} label="用户数" value={summary.users || 0} />
        <Metric icon={<Server />} label="服务器" value={summary.servers || 0} />
        <Metric icon={<ReceiptText />} label="订单数" value={summary.orders || 0} />
        <Metric icon={<CircleDollarSign />} label="营业额" value={formatMoney(summary.income || 0)} />
      </div>
      <Panel title="业务概览"><div className="chart-bars">{[56, 80, 42, 66, 92, 70, 88].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></Panel>
    </div>
  );
}

function AdminProducts({ products, form, setForm, addProduct, updateProductStatus }) {
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="admin-page">
      <h1>产品管理</h1>
      <Panel title="新增购买方案">
        <form className="admin-form product-form" onSubmit={addProduct}>
          <input placeholder="产品名称" value={form.name} onChange={(event) => setField('name', event.target.value)} required />
          <input placeholder="类型" value={form.type} onChange={(event) => setField('type', event.target.value)} />
          <input placeholder="地区" value={form.location} onChange={(event) => setField('location', event.target.value)} />
          <input placeholder="CPU" value={form.cpu} onChange={(event) => setField('cpu', event.target.value)} />
          <input placeholder="内存" value={form.memory} onChange={(event) => setField('memory', event.target.value)} />
          <input placeholder="硬盘" value={form.disk} onChange={(event) => setField('disk', event.target.value)} />
          <input placeholder="带宽" value={form.bandwidth} onChange={(event) => setField('bandwidth', event.target.value)} />
          <input placeholder="防护" value={form.defense} onChange={(event) => setField('defense', event.target.value)} />
          <input placeholder="月付" type="number" min="0.01" step="0.01" value={form.priceMonthly} onChange={(event) => setField('priceMonthly', event.target.value)} required />
          <input placeholder="年付" type="number" min="0.01" step="0.01" value={form.priceYearly} onChange={(event) => setField('priceYearly', event.target.value)} required />
          <input placeholder="库存" type="number" min="0" value={form.stock} onChange={(event) => setField('stock', event.target.value)} />
          <textarea placeholder="产品说明" value={form.description} onChange={(event) => setField('description', event.target.value)} />
          <button className="primary" type="submit"><Plus size={17} />新增</button>
        </form>
      </Panel>
      <DataTable columns={['产品名称', '类型', '地区', '配置', '月付', '年付', '库存', '状态', '操作']} rows={products.map((product) => [
        product.name,
        product.type,
        product.location,
        `${product.cpu} / ${product.memory} / ${product.disk}`,
        formatMoney(product.priceMonthly),
        formatMoney(product.priceYearly),
        product.stock,
        product.status,
        <button className="table-action" onClick={() => updateProductStatus(product, product.status === 'on_sale' ? 'off_sale' : 'on_sale')}>{product.status === 'on_sale' ? '下架' : '上架'}</button>
      ])} />
    </div>
  );
}

function AdminOrders({ orders, markPaid }) {
  return <div className="admin-page"><h1>订单管理</h1><DataTable columns={['订单号', '用户', '产品', '类型', '金额', '支付', '开通', '操作']} rows={orders.map((order) => [order.orderNo, order.user?.username, order.product?.name || '-', order.type, formatMoney(order.amount), order.payStatus, order.provisionStatus, order.payStatus === 'unpaid' ? <button className="table-action" onClick={() => markPaid(order.id)}>确认支付</button> : '-'])} /></div>;
}

function AdminServers({ servers, orders, form, setForm, openServer }) {
  useEffect(() => {
    if (!form.orderId && orders[0]) setForm((prev) => ({ ...prev, orderId: orders[0].id, name: orders[0].product?.name || '' }));
  }, [orders, form.orderId, setForm]);
  return (
    <div className="admin-page">
      <h1>服务器管理</h1>
      <Panel title="从已支付订单开通服务器">
        <form className="admin-form product-form" onSubmit={openServer}>
          <select value={form.orderId} onChange={(event) => setForm((prev) => ({ ...prev, orderId: event.target.value }))}>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNo} / {order.user?.username}</option>)}</select>
          <input placeholder="服务器名称" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          <input placeholder="IP" value={form.ip} onChange={(event) => setForm((prev) => ({ ...prev, ip: event.target.value }))} required />
          <input placeholder="系统" value={form.os} onChange={(event) => setForm((prev) => ({ ...prev, os: event.target.value }))} />
          <input placeholder="登录用户" value={form.loginUser} onChange={(event) => setForm((prev) => ({ ...prev, loginUser: event.target.value }))} />
          <input placeholder="登录密码" value={form.loginPassword} onChange={(event) => setForm((prev) => ({ ...prev, loginPassword: event.target.value }))} required />
          <input type="date" value={form.expiresAt} onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))} />
          <button className="primary" type="submit"><PackagePlus size={17} />开通</button>
        </form>
      </Panel>
      <DataTable columns={['服务器', '用户', 'IP', '系统', '到期', '状态']} rows={servers.map((server) => [server.name, server.user?.username, server.ip, server.os, formatDate(server.expiresAt), server.status])} />
    </div>
  );
}

function AdminUsers({ users, openRecharge, impersonate }) {
  return <div className="admin-page"><h1>用户管理</h1><DataTable columns={['用户', '邮箱', '余额', '状态', '注册时间', '操作']} rows={users.map((user) => [user.username, user.email, formatMoney(user.balance), user.status, formatDate(user.createdAt), <><button className="table-action" onClick={() => openRecharge(user)}>充值</button><button className="table-action" onClick={() => impersonate(user.id)}>代登录</button></>])} /></div>;
}

function AdminTickets({ tickets, openReply }) {
  return <div className="admin-page"><h1>工单管理</h1><DataTable columns={['标题', '用户', '状态', '更新时间', '操作']} rows={tickets.map((ticket) => [ticket.title, ticket.user?.username, ticket.status, formatDate(ticket.updatedAt), <button className="table-action" onClick={() => openReply(ticket)}>回复</button>])} /></div>;
}

function AdminLogs({ logs, settings, settingsForm, setSettingsForm, saveSettings }) {
  const settingLabel = {
    site_name: '站点名称',
    support_phone: '客服电话',
    support_email: '客服邮箱',
    copyright: '版权信息',
    hero_title: '首页标题',
    hero_subtitle: '首页副标题',
    registration_enabled: '开放注册',
    expiry_remind_days: '到期提醒天数',
    overdue_suspend_days: '逾期暂停天数'
  };
  const update = (key, value) => setSettingsForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="admin-page">
      <h1>操作日志</h1>
      <Panel title="系统配置">
        <form className="settings-grid" onSubmit={saveSettings}>
          {settings.map((item) => (
            <label key={item.key}>{settingLabel[item.key] || item.key}<input value={settingsForm[item.key] ?? item.value} onChange={(event) => update(item.key, event.target.value)} /></label>
          ))}
          <button className="primary" type="submit">保存配置</button>
        </form>
      </Panel>
      <DataTable columns={['动作', '目标', '管理员', '时间', '详情']} rows={logs.map((log) => [log.action, `${log.targetType}:${log.targetId || '-'}`, log.admin?.username || '-', formatDate(log.createdAt), log.detail || '-'])} />
    </div>
  );
}

function Metric({ icon, label, value }) {
  return <article className="metric-card"><div>{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}

function Panel({ title, children }) {
  return <section className="panel"><div className="panel-title"><h2>{title}</h2></div>{children}</section>;
}

function DataTable({ columns, rows }) {
  return (
    <section className="panel">
      <div className="responsive-table">
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function Rows({ rows }) {
  if (!rows.length) return <p className="muted">暂无数据</p>;
  return rows.map((row, index) => <div className="list-item" key={index}><span>{row.left}</span><strong>{row.mid}</strong><em>{row.right}</em>{row.action}</div>);
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="关闭"><X size={18} /></button></div>
        {children}
      </section>
    </div>
  );
}

function PublicFooter({ siteSettings }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div><div className="footer-brand"><Cloud size={26} />{siteSettings.site_name}</div><p>專業互聯網基礎服務提供商，香港伺服器、美國伺服器及 VPS 服務商。</p></div>
        <div><h3>產品中心</h3><a>雲伺服器</a><a>伺服器租用</a><a>伺服器託管</a></div>
        <div><h3>服務支援</h3><a>服務條款</a><a>私隱政策</a><a>提交工單</a></div>
        <div><h3>聯絡我們</h3><p>中國·香港</p><p>{siteSettings.support_phone}</p><p>{siteSettings.support_email}</p></div>
      </div>
      <div className="copyright">{siteSettings.copyright}</div>
    </footer>
  );
}

createRoot(document.getElementById('root')).render(<App />);
