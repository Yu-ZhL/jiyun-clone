import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  Cloud,
  CreditCard,
  Database,
  Gauge,
  Globe2,
  Headphones,
  Home,
  Layers,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  PackagePlus,
  PanelLeft,
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

const STORAGE_KEY = 'jiyun-clone-state-v1';

const defaultState = {
  currentUserId: 'u-1001',
  adminAuthed: false,
  users: [
    { id: 'u-1001', name: '陳先生', email: 'chan@example.hk', balance: 2860, status: '正常', joined: '2026-05-01' },
    { id: 'u-1002', name: 'HKT Media', email: 'ops@hktmedia.hk', balance: 1180, status: '正常', joined: '2026-05-03' },
    { id: 'u-1003', name: '測試客戶', email: 'demo@example.hk', balance: 0, status: '待審核', joined: '2026-05-06' }
  ],
  products: [
    {
      id: 'p-cloud-hk',
      type: '云服务器',
      name: '香港 BGP 云服务器',
      location: '中國香港',
      cpu: '4 vCPU',
      memory: '8 GB',
      disk: '120 GB SSD',
      bandwidth: '20M CN2/BGP',
      defense: '50G 防护',
      priceMonthly: 60,
      priceYearly: 600,
      status: '上架',
      featured: true
    },
    {
      id: 'p-dedicated-hk',
      type: '服务器租用',
      name: '香港独立服务器 E5',
      location: 'HK T3+ 数据中心',
      cpu: 'E5-2680 v4',
      memory: '32 GB',
      disk: '1 TB SSD',
      bandwidth: '30M 独享',
      defense: '100G 防护',
      priceMonthly: 360,
      priceYearly: 3600,
      status: '上架',
      featured: true
    },
    {
      id: 'p-colo-hk',
      type: '服务器托管',
      name: '1U 服务器托管',
      location: '中國香港',
      cpu: '自带设备',
      memory: '1U 机位',
      disk: '双路电力',
      bandwidth: '10M 独享',
      defense: '基础清洗',
      priceMonthly: 500,
      priceYearly: 5000,
      status: '上架',
      featured: false
    }
  ],
  servers: [
    {
      id: 's-8001',
      productId: 'p-cloud-hk',
      userId: 'u-1001',
      name: 'HK-CN2-01',
      ip: '103.88.12.18',
      rootUser: 'administrator',
      password: 'JYhk2026!',
      os: 'Windows Server 2022',
      expires: '2026-06-07',
      status: '运行中'
    },
    {
      id: 's-8002',
      productId: 'p-dedicated-hk',
      userId: 'u-1002',
      name: 'HK-Dedi-02',
      ip: '154.23.77.21',
      rootUser: 'root',
      password: 'JYlinux2026!',
      os: 'Ubuntu 22.04',
      expires: '2026-06-12',
      status: '运行中'
    }
  ],
  orders: [
    { id: 'o-9001', userId: 'u-1001', productId: 'p-cloud-hk', cycle: '月付', amount: 60, status: '已支付', createdAt: '2026-05-07 10:25' },
    { id: 'o-9002', userId: 'u-1002', productId: 'p-dedicated-hk', cycle: '月付', amount: 360, status: '已支付', createdAt: '2026-05-07 11:12' }
  ],
  tickets: [
    { id: 't-3001', userId: 'u-1001', title: '請協助重裝系統', status: '处理中', updatedAt: '2026-05-07 12:42' },
    { id: 't-3002', userId: 'u-1002', title: '帶寬升級查詢', status: '已回复', updatedAt: '2026-05-07 14:05' }
  ]
};

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
  serviceTitle: '完美的託管解決方案',
  buyTitle: '選擇合適的伺服器方案',
  consoleTitle: '客戶後台',
  cartTitle: '確認訂單'
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return defaultState;
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('zh-HK')}`;
}

function todayPlus(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function App() {
  const [state, setState] = useState(loadState);
  const [route, setRoute] = useState(() => window.location.hash.replace('#', '') || '/');
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace('#', '') || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const currentUser = state.users.find((user) => user.id === state.currentUserId) || state.users[0];
  const navigate = (nextRoute) => {
    window.location.hash = nextRoute;
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const actions = {
    navigate,
    setState,
    setCurrentUser: (userId) => setState((prev) => ({ ...prev, currentUserId: userId })),
    adminLogin: () => setState((prev) => ({ ...prev, adminAuthed: true })),
    adminLogout: () => setState((prev) => ({ ...prev, adminAuthed: false })),
    createOrder: ({ product, cycle }) => {
      const amount = cycle === '年付' ? product.priceYearly : product.priceMonthly;
      const id = `o-${Date.now().toString().slice(-6)}`;
      const serverId = `s-${Date.now().toString().slice(-5)}`;
      setState((prev) => ({
        ...prev,
        orders: [
          { id, userId: prev.currentUserId, productId: product.id, cycle, amount, status: '已支付', createdAt: new Date().toLocaleString('zh-HK', { hour12: false }) },
          ...prev.orders
        ],
        servers: [
          {
            id: serverId,
            productId: product.id,
            userId: prev.currentUserId,
            name: `${product.location.replace(/\s/g, '')}-${serverId}`,
            ip: '待分配',
            rootUser: 'root',
            password: '待管理员录入',
            os: '待安装',
            expires: todayPlus(cycle === '年付' ? 365 : 30),
            status: '待开通'
          },
          ...prev.servers
        ]
      }));
      navigate('/client');
    }
  };

  const sharedProps = { state, currentUser, actions };
  const isAdmin = route.startsWith('/admin');
  const isClient = route.startsWith('/client');

  return (
    <div className={isAdmin ? 'app admin-shell-bg' : 'app'}>
      {!isAdmin && <PublicHeader route={route} mobileNav={mobileNav} setMobileNav={setMobileNav} {...sharedProps} />}
      {route === '/' && <HomePage {...sharedProps} />}
      {route === '/buy' && <BuyPage {...sharedProps} />}
      {isClient && <ClientDashboard {...sharedProps} />}
      {isAdmin && <AdminApp {...sharedProps} />}
      {!isAdmin && <PublicFooter />}
    </div>
  );
}

function PublicHeader({ actions, currentUser, route, mobileNav, setMobileNav }) {
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
          <span>800-800-8000</span>
          <span>support@example.com</span>
          <button onClick={() => actions.navigate('/client')}>控制台</button>
          <button onClick={() => actions.navigate('/client')}>提交工單</button>
        </div>
      </div>
      <div className="container nav-row">
        <button className="brand" onClick={() => actions.navigate('/')}>
          <span className="brand-mark"><Cloud size={24} /></span>
          <span>
            <strong>極雲</strong>
            <small>主機管理系統</small>
          </span>
        </button>
        <nav className={mobileNav ? 'nav-links open' : 'nav-links'}>
          {nav.map((item) => (
            <button key={item.path + item.label} className={route === item.path ? 'active' : ''} onClick={() => actions.navigate(item.path)}>
              {item.label}
            </button>
          ))}
          <button onClick={() => actions.navigate('/admin')} className="ghost-link">{hk.navAdmin}</button>
        </nav>
        <div className="nav-actions">
          <button className="text-btn" onClick={() => actions.navigate('/client')}><LogIn size={16} />{hk.login}</button>
          <button className="primary small" onClick={() => actions.navigate('/buy')}>{hk.register}</button>
          <button className="icon-btn mobile-only" aria-label="menu" onClick={() => setMobileNav((value) => !value)}>
            {mobileNav ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}

function HomePage({ state, actions }) {
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
            <h1>{hk.heroTitle}</h1>
            <p>{hk.heroSub}</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => actions.navigate('/buy')}>{hk.primaryCta}</button>
              <button className="secondary" onClick={() => actions.navigate('/client')}>{hk.secondaryCta}</button>
            </div>
          </div>
          <div className="hero-panel">
            <div>
              <span>在線節點</span>
              <strong>30+</strong>
            </div>
            <div>
              <span>客戶選擇</span>
              <strong>10000+</strong>
            </div>
            <div>
              <span>交付時間</span>
              <strong>分鐘級</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-title">
          <span>{'{{ item.name }}'}</span>
          <h2>{hk.why}</h2>
        </div>
        <div className="why-grid">
          {cards.map((card) => (
            <article className="feature-card" key={card.title}>
              <div className="feature-icon">{card.icon}</div>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-band">
        <div className="container section">
          <div className="section-title">
            <span>Hosting Products</span>
            <h2>{hk.productTitle}</h2>
          </div>
          <ProductGrid products={state.products.filter((product) => product.status === '上架')} actions={actions} />
        </div>
      </section>

      <section className="container split-section">
        <div className="server-photo" />
        <div className="split-copy">
          <span className="eyebrow">Powerful Platform</span>
          <h2>強大的伺服器和平台</h2>
          <p>採用前沿多網融合技術、T3+ 數據中心和完備冗餘保護機制，協助企業拓展線上業務。</p>
          <div className="info-list">
            <div><ShieldCheck size={20} />防火牆安全防護</div>
            <div><Globe2 size={20} />遍佈全球可用區</div>
            <div><Zap size={20} />在線開通分鐘級交付</div>
          </div>
          <button className="primary" onClick={() => actions.navigate('/buy')}>從這裏開始</button>
        </div>
      </section>

      <section className="service-strip">
        <div className="container service-grid">
          {['雲伺服器', '伺服器租用', '伺服器託管', '域名註冊', 'SSL 證書', '解決方案'].map((item, index) => (
            <article key={item}>
              <div className="round-icon">{[<Cloud />, <Server />, <Database />, <Globe2 />, <LockKeyhole />, <Layers />][index]}</div>
              <h3>{item}</h3>
              <p>{index < 3 ? '高速穩定、安全可靠，適合企業網站、電商及跨境業務。' : '一站式基礎服務，配合主機產品快速部署。'}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function ProductGrid({ products, actions }) {
  return (
    <div className="pricing-grid">
      {products.map((product) => (
        <article className={product.featured ? 'price-card featured' : 'price-card'} key={product.id}>
          <div className="price-image"><Server /></div>
          <span className="pill">{product.type}</span>
          <h3>{product.name}</h3>
          <p>{product.location} / {product.bandwidth}</p>
          <div className="price">起價 <strong>{formatMoney(product.priceMonthly)}</strong><span>/月</span></div>
          <ul>
            <li><Check size={16} />{product.cpu}</li>
            <li><Check size={16} />{product.memory}</li>
            <li><Check size={16} />{product.disk}</li>
            <li><Check size={16} />{product.defense}</li>
          </ul>
          <button className="primary wide" onClick={() => actions.navigate(`/buy?product=${product.id}`)}>購買</button>
        </article>
      ))}
    </div>
  );
}

function BuyPage({ state, actions }) {
  const params = new URLSearchParams((window.location.hash.split('?')[1] || ''));
  const initial = params.get('product') || state.products[0]?.id;
  const [productId, setProductId] = useState(initial);
  const [cycle, setCycle] = useState('月付');
  const product = state.products.find((item) => item.id === productId) || state.products[0];

  return (
    <main className="buy-page">
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Product Center</span>
          <h1>{hk.buyTitle}</h1>
          <p>選擇方案後即可提交訂單，系統會生成待開通伺服器，管理員可在總後台手動錄入 IP、系統和密碼。</p>
        </div>
      </section>
      <section className="container buy-layout">
        <div className="catalog">
          <div className="toolbar">
            <div className="searchbox"><Search size={18} /><span>香港 / CN2 / 高防</span></div>
            <div className="segment">
              <button className={cycle === '月付' ? 'active' : ''} onClick={() => setCycle('月付')}>月付</button>
              <button className={cycle === '年付' ? 'active' : ''} onClick={() => setCycle('年付')}>年付</button>
            </div>
          </div>
          <div className="server-list">
            {state.products.filter((item) => item.status === '上架').map((item) => (
              <button key={item.id} className={item.id === product.id ? 'server-row selected' : 'server-row'} onClick={() => setProductId(item.id)}>
                <span><Server size={20} />{item.name}</span>
                <span>{item.cpu}</span>
                <span>{item.memory}</span>
                <strong>{formatMoney(cycle === '年付' ? item.priceYearly : item.priceMonthly)}</strong>
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
            <div><dt>週期</dt><dd>{cycle}</dd></div>
          </dl>
          <div className="total">
            <span>合計</span>
            <strong>{formatMoney(cycle === '年付' ? product.priceYearly : product.priceMonthly)}</strong>
          </div>
          <button className="primary wide" onClick={() => actions.createOrder({ product, cycle })}>
            <ShoppingCart size={18} />提交訂單
          </button>
          <p>演示系統默認為已支付，實際開通資料由總後台人工錄入。</p>
        </aside>
      </section>
    </main>
  );
}

function ClientDashboard({ state, currentUser, actions }) {
  const servers = state.servers.filter((server) => server.userId === currentUser.id);
  const orders = state.orders.filter((order) => order.userId === currentUser.id);
  const tickets = state.tickets.filter((ticket) => ticket.userId === currentUser.id);

  return (
    <main className="client-shell">
      <aside className="client-sidebar">
        <div className="client-profile">
          <div className="avatar">{currentUser.name.slice(0, 1)}</div>
          <strong>{currentUser.name}</strong>
          <span>{currentUser.email}</span>
        </div>
        {[
          [LayoutDashboard, '總覽'],
          [Server, '我的伺服器'],
          [ReceiptText, '訂單記錄'],
          [Ticket, '工單支援'],
          [CreditCard, '財務中心']
        ].map(([Icon, label]) => (
          <button key={label} className={label === '總覽' ? 'active' : ''}><Icon size={18} />{label}</button>
        ))}
      </aside>
      <section className="client-content">
        <div className="dashboard-head">
          <div>
            <span className="eyebrow">Client Console</span>
            <h1>{hk.consoleTitle}</h1>
          </div>
          <button className="primary" onClick={() => actions.navigate('/buy')}><Plus size={18} />購買伺服器</button>
        </div>
        <div className="metric-grid">
          <Metric icon={<Server />} label="伺服器" value={servers.length} />
          <Metric icon={<ReceiptText />} label="訂單" value={orders.length} />
          <Metric icon={<CreditCard />} label="餘額" value={formatMoney(currentUser.balance)} />
          <Metric icon={<Ticket />} label="工單" value={tickets.length} />
        </div>
        <section className="panel">
          <div className="panel-title"><h2>我的伺服器</h2><button>刷新</button></div>
          <div className="responsive-table">
            <table>
              <thead><tr><th>名稱</th><th>IP</th><th>系統</th><th>到期時間</th><th>狀態</th><th>操作</th></tr></thead>
              <tbody>
                {servers.map((server) => (
                  <tr key={server.id}>
                    <td>{server.name}</td>
                    <td>{server.ip}</td>
                    <td>{server.os}</td>
                    <td>{server.expires}</td>
                    <td><span className="status green">{server.status}</span></td>
                    <td><button className="table-action">管理</button><button className="table-action">重啟</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div className="two-col">
          <section className="panel">
            <div className="panel-title"><h2>最近訂單</h2></div>
            {orders.slice(0, 5).map((order) => (
              <div className="list-item" key={order.id}>
                <span>{order.id}</span>
                <strong>{formatMoney(order.amount)}</strong>
                <em>{order.status}</em>
              </div>
            ))}
          </section>
          <section className="panel">
            <div className="panel-title"><h2>服務支援</h2><button>提交工單</button></div>
            {tickets.map((ticket) => (
              <div className="list-item" key={ticket.id}>
                <span>{ticket.title}</span>
                <strong>{ticket.updatedAt}</strong>
                <em>{ticket.status}</em>
              </div>
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }) {
  return (
    <article className="metric-card">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AdminApp({ state, actions }) {
  const [section, setSection] = useState('dashboard');
  if (!state.adminAuthed) return <AdminLogin actions={actions} />;
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
          ['settings', Settings, '系统设置']
        ].map(([key, Icon, label]) => (
          <button key={key} className={section === key ? 'active' : ''} onClick={() => setSection(key)}><Icon size={18} />{label}</button>
        ))}
      </aside>
      <section className="admin-main">
        <div className="admin-top">
          <button className="icon-btn"><PanelLeft size={19} /></button>
          <div className="admin-search"><Search size={17} />搜索菜单 / 订单 / 用户</div>
          <button className="icon-btn"><Bell size={18} /></button>
          <button className="admin-user" onClick={actions.adminLogout}><User size={17} />admin<ChevronDown size={15} /></button>
        </div>
        {section === 'dashboard' && <AdminDashboard state={state} />}
        {section === 'servers' && <AdminServers state={state} actions={actions} />}
        {section === 'products' && <AdminProducts state={state} actions={actions} />}
        {section === 'orders' && <AdminOrders state={state} />}
        {section === 'users' && <AdminUsers state={state} actions={actions} />}
        {section === 'settings' && <AdminSettings />}
      </section>
    </main>
  );
}

function AdminLogin({ actions }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (username === 'admin' && password === '123456') actions.adminLogin();
    else setError('账号或密码错误');
  };

  return (
    <main className="login-page">
      <div className="login-visual">
        <div className="login-illustration">
          <Cloud size={72} />
          <h1>主机管理系统</h1>
          <p>以 超 乎 想 象 的 速 度 构 建 内 部 工 具</p>
        </div>
      </div>
      <form className="login-form-card" onSubmit={submit}>
        <h2>主机管理系统</h2>
        <p>管理员中文后台</p>
        <label>账户<input value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>验证码<input value="8888" readOnly /></label>
        <div className="remember"><input type="checkbox" defaultChecked />自动登录</div>
        {error && <div className="form-error">{error}</div>}
        <button className="primary wide" type="submit">登 录</button>
        <div className="login-foot">其他方式 <button type="button">简体中文</button></div>
      </form>
    </main>
  );
}

function AdminDashboard({ state }) {
  const income = state.orders.reduce((sum, order) => sum + order.amount, 0);
  return (
    <div className="admin-page">
      <h1>控制台</h1>
      <div className="admin-metrics">
        <Metric icon={<Users />} label="用户数" value={state.users.length} />
        <Metric icon={<Server />} label="服务器" value={state.servers.length} />
        <Metric icon={<ReceiptText />} label="订单数" value={state.orders.length} />
        <Metric icon={<CircleDollarSign />} label="营业额" value={formatMoney(income)} />
      </div>
      <div className="two-col">
        <section className="panel">
          <div className="panel-title"><h2>业务概览</h2></div>
          <div className="chart-bars">
            {[56, 80, 42, 66, 92, 70, 88].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title"><h2>近期动态</h2></div>
          {state.orders.slice(0, 5).map((order) => <div className="list-item" key={order.id}><span>{order.id}</span><strong>{order.createdAt}</strong><em>{order.status}</em></div>)}
        </section>
      </div>
    </div>
  );
}

function AdminServers({ state, actions }) {
  const empty = { userId: state.users[0]?.id || '', productId: state.products[0]?.id || '', name: '', ip: '', rootUser: 'root', password: '', os: 'Ubuntu 22.04', expires: todayPlus(30), status: '运行中' };
  const [form, setForm] = useState(empty);
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    actions.setState((prev) => ({ ...prev, servers: [{ ...form, id: `s-${Date.now().toString().slice(-5)}` }, ...prev.servers] }));
    setForm(empty);
  };

  return (
    <div className="admin-page">
      <h1>服务器管理</h1>
      <section className="panel admin-form-panel">
        <div className="panel-title"><h2>手动录入服务器信息</h2></div>
        <form className="admin-form" onSubmit={submit}>
          <select value={form.userId} onChange={(event) => update('userId', event.target.value)}>{state.users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select>
          <select value={form.productId} onChange={(event) => update('productId', event.target.value)}>{state.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
          <input placeholder="服务器名称" value={form.name} onChange={(event) => update('name', event.target.value)} required />
          <input placeholder="IP 地址" value={form.ip} onChange={(event) => update('ip', event.target.value)} required />
          <input placeholder="登录账号" value={form.rootUser} onChange={(event) => update('rootUser', event.target.value)} />
          <input placeholder="登录密码" value={form.password} onChange={(event) => update('password', event.target.value)} />
          <input placeholder="系统" value={form.os} onChange={(event) => update('os', event.target.value)} />
          <input type="date" value={form.expires} onChange={(event) => update('expires', event.target.value)} />
          <button className="primary" type="submit"><PackagePlus size={17} />保存</button>
        </form>
      </section>
      <DataTable
        columns={['服务器', '用户', 'IP', '系统', '到期', '状态']}
        rows={state.servers.map((server) => [
          server.name,
          state.users.find((user) => user.id === server.userId)?.name || '-',
          server.ip,
          server.os,
          server.expires,
          server.status
        ])}
      />
    </div>
  );
}

function AdminProducts({ state, actions }) {
  const [form, setForm] = useState({ type: '云服务器', name: '', location: '中国香港', cpu: '2 vCPU', memory: '4 GB', disk: '80 GB SSD', bandwidth: '10M CN2', defense: '20G 防护', priceMonthly: 88, priceYearly: 880, status: '上架', featured: false });
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const submit = (event) => {
    event.preventDefault();
    actions.setState((prev) => ({ ...prev, products: [{ ...form, id: `p-${Date.now().toString().slice(-6)}` }, ...prev.products] }));
    setForm((prev) => ({ ...prev, name: '' }));
  };
  return (
    <div className="admin-page">
      <h1>产品管理</h1>
      <section className="panel admin-form-panel">
        <div className="panel-title"><h2>新增购买方案</h2></div>
        <form className="admin-form product-form" onSubmit={submit}>
          {['type', 'name', 'location', 'cpu', 'memory', 'disk', 'bandwidth', 'defense'].map((key) => (
            <input key={key} placeholder={key} value={form[key]} onChange={(event) => update(key, event.target.value)} required />
          ))}
          <input type="number" value={form.priceMonthly} onChange={(event) => update('priceMonthly', Number(event.target.value))} />
          <input type="number" value={form.priceYearly} onChange={(event) => update('priceYearly', Number(event.target.value))} />
          <button className="primary" type="submit"><Plus size={17} />新增</button>
        </form>
      </section>
      <DataTable
        columns={['产品名称', '类型', '地区', '月付', '年付', '状态']}
        rows={state.products.map((product) => [product.name, product.type, product.location, formatMoney(product.priceMonthly), formatMoney(product.priceYearly), product.status])}
      />
    </div>
  );
}

function AdminOrders({ state }) {
  return (
    <div className="admin-page">
      <h1>订单管理</h1>
      <DataTable
        columns={['订单号', '用户', '产品', '周期', '金额', '状态']}
        rows={state.orders.map((order) => [
          order.id,
          state.users.find((user) => user.id === order.userId)?.name || '-',
          state.products.find((product) => product.id === order.productId)?.name || '-',
          order.cycle,
          formatMoney(order.amount),
          order.status
        ])}
      />
    </div>
  );
}

function AdminUsers({ state, actions }) {
  return (
    <div className="admin-page">
      <h1>用户管理</h1>
      <section className="panel">
        <div className="responsive-table">
          <table>
            <thead><tr><th>用户</th><th>邮箱</th><th>余额</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead>
            <tbody>
              {state.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{formatMoney(user.balance)}</td>
                  <td><span className="status green">{user.status}</span></td>
                  <td>{user.joined}</td>
                  <td><button className="table-action" onClick={() => { actions.setCurrentUser(user.id); actions.navigate('/client'); }}>进入前台</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminSettings() {
  return (
    <div className="admin-page">
      <h1>系统设置</h1>
      <section className="panel settings-grid">
        <label>站点名称<input defaultValue="极云主机管理系统" /></label>
        <label>客服电话<input defaultValue="800-800-8000" /></label>
        <label>客服邮箱<input defaultValue="support@example.com" /></label>
        <label>版权信息<input defaultValue="版权信息:11111" /></label>
        <button className="primary">保存设置</button>
      </section>
    </div>
  );
}

function DataTable({ columns, rows }) {
  return (
    <section className="panel">
      <div className="panel-title"><h2>数据列表</h2><button>导出</button></div>
      <div className="responsive-table">
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

function PublicFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand"><Cloud size={26} />極雲主機管理系統</div>
          <p>專業互聯網基礎服務提供商，香港伺服器、美國伺服器及 VPS 服務商。</p>
        </div>
        <div><h3>產品中心</h3><a>雲伺服器</a><a>伺服器租用</a><a>伺服器託管</a></div>
        <div><h3>服務支援</h3><a>服務條款</a><a>私隱政策</a><a>提交工單</a></div>
        <div><h3>聯絡我們</h3><p>中國·香港</p><p>800-800-8000</p><p>support@example.com</p></div>
      </div>
      <div className="copyright">10000+ 個客戶共同選擇了主機管理系統 · 版權信息:11111</div>
    </footer>
  );
}

createRoot(document.getElementById('root')).render(<App />);
