import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bell,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Cloud,
  CreditCard,
  Database,
  Globe2,
  Headphones,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
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

function moneyInput(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-HK', { hour12: false });
}

function dateInput(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

const orderTypeLabels = {
  new_server: '新购服务器',
  renew_server: '续费订单'
};

const payStatusLabels = {
  unpaid: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  refunded: '已退款'
};

const provisionStatusLabels = {
  none: '无需开通',
  pending: '待开通',
  opened: '已开通'
};

const ticketStatusLabels = {
  open: '待处理',
  replied: '已回复',
  closed: '已关闭'
};

const userStatusLabels = {
  active: '正常',
  disabled: '已禁用'
};

const productStatusLabels = {
  on_sale: '上架中',
  off_sale: '已下架'
};

const serverStatusLabels = {
  pending: '待开通',
  running: '运行中',
  suspended: '已暂停',
  expired: '已到期',
  expiring: '即将到期',
  deleted: '已删除'
};

function textIncludes(value, keyword) {
  return String(value || '').toLowerCase().includes(keyword.toLowerCase());
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
      {routePath === '/products' && <ProductsPage {...shared} />}
      {routePath === '/buy' && <BuyPage {...shared} />}
      {routePath.startsWith('/client') && <ClientPortal {...shared} />}
      {isAdmin && <AdminPortal {...shared} />}
      {!isAdmin && <PublicFooter siteSettings={siteSettings} navigate={navigate} />}
    </div>
  );
}

function PublicHeader({ navigate, routePath, user, mobileNav, setMobileNav, siteSettings, refreshUser, setNotice }) {
  const nav = [
    { label: hk.navHome, path: '/' },
    { label: hk.navProducts, path: '/products' },
    { label: hk.navBuy, path: '/buy' },
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
          <button onClick={() => navigate('/client?tickets')}>提交工單</button>
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

function HomePage({ products, navigate, siteSettings }) {
  const heroSlides = [
    {
      kicker: '香港 T3+ 數據中心',
      title: siteSettings.hero_title,
      text: siteSettings.hero_subtitle,
      image: '/assets/homepage-slide-1.png',
      stats: [['可售庫存', `${products.reduce((sum, product) => sum + product.stock, 0)}+`], ['產品方案', String(products.length)], ['交付模式', '後台開通']]
    },
    {
      kicker: 'CN2 / BGP 優化線路',
      title: '跨境業務穩定承載',
      text: '面向企業網站、電商平台和 SaaS 業務，提供低延遲接入、高防清洗和可追蹤交付。',
      image: '/assets/homepage-slide-2.png',
      stats: [['線路策略', 'CN2/BGP'], ['節點視野', 'Global'], ['網絡監控', '7x24']]
    },
    {
      kicker: '高防安全架構',
      title: '為核心業務抵禦流量攻擊',
      text: '高防清洗、伺服器密碼加密、到期任務與操作日志共同支撐可追蹤的運營交付。',
      image: '/assets/homepage-slide-3.png',
      stats: [['防護能力', 'DDoS'], ['密碼保存', 'AES'], ['操作日志', '全量']]
    }
  ];
  const [activeSlide, setActiveSlide] = useState(0);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const cards = [
    { icon: <Zap />, title: '領先的產品技術', text: '提供中小企業及個人用戶友好的雲伺服器、高防及託管服務。' },
    { icon: <ShieldCheck />, title: '安全防護', text: '基於智能清洗策略，為核心業務提供穩定可靠的防護能力。' },
    { icon: <Headphones />, title: '無憂售後服務', text: '7x24 小時技術支援，電話、工單、客服多種方式快速響應。' }
  ];
  const testimonials = [
    ['跨境電商團隊', '香港節點延遲穩定，晚高峰訪問也沒有明顯波動，工單回覆比之前的供應商快很多。', 'HK / CN2'],
    ['SaaS 運維負責人', '後台能看到訂單、續費、到期和伺服器資料，人工開通模式也能保持清楚的交付記錄。', 'OPS'],
    ['內容平台站長', '高防方案上線後攻擊期間服務沒有中斷，續費通知和站內通知對日常運維很有幫助。', 'DDoS'],
    ['遊戲社群運營', '活動高峰期登入和支付都很平穩，伺服器資料、續費和工單可以直接在同一個後台處理。', 'Peak'],
    ['出海工具團隊', '採購、開通、續費和到期提醒一條鏈路走完，財務流水也能對上每一筆訂單。', 'Finance']
  ];
  const visibleTestimonials = testimonials.map((item, offset) => testimonials[(testimonialIndex + offset) % testimonials.length]).slice(0, 3);
  const slide = heroSlides[activeSlide];
  const goSlide = (direction) => setActiveSlide((index) => (index + direction + heroSlides.length) % heroSlides.length);
  const goTestimonial = (direction) => setTestimonialIndex((index) => (index + direction + testimonials.length) % testimonials.length);

  useEffect(() => {
    const timer = window.setInterval(() => setActiveSlide((index) => (index + 1) % heroSlides.length), 5200);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    const timer = window.setInterval(() => goTestimonial(1), 6200);
    return () => window.clearInterval(timer);
  }, [testimonials.length]);

  return (
    <main>
      <section className="hero" style={{ '--hero-image': `url("${slide.image}")` }}>
        <div className="hero-media" key={slide.image} />
        <div className="container hero-content">
          <div className="hero-copy" key={slide.title}>
            <span className="eyebrow">{slide.kicker}</span>
            <h1>{slide.title}</h1>
            <p>{slide.text}</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => navigate('/buy')}>{hk.primaryCta}</button>
              <button className="secondary" onClick={() => navigate('/client')}>{hk.secondaryCta}</button>
            </div>
            <div className="hero-dots" aria-label="首頁輪播">
              {heroSlides.map((item, index) => (
                <button key={item.kicker} className={index === activeSlide ? 'active' : ''} aria-label={`切換到第 ${index + 1} 張`} onClick={() => setActiveSlide(index)} />
              ))}
            </div>
            <div className="hero-arrows">
              <button aria-label="上一張輪播" onClick={() => goSlide(-1)}><ChevronLeft size={20} /></button>
              <button aria-label="下一張輪播" onClick={() => goSlide(1)}><ChevronRight size={20} /></button>
            </div>
          </div>
          <div className="hero-showcase" key={`${slide.image}-showcase`}>
            <img src={slide.image} alt={`${slide.title}場景`} />
            <div className="hero-panel">
              {slide.stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
            </div>
          </div>
        </div>
      </section>
      <section className="proof-rail">
        <div className="container proof-grid">
          <div><strong>CN2 / BGP</strong><span>香港優化線路</span></div>
          <div><strong>7x24</strong><span>工單與運維支援</span></div>
          <div><strong>AES</strong><span>伺服器密碼加密</span></div>
          <div><strong>Docker</strong><span>前後台一鍵部署</span></div>
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
          <div className="section-title"><span>Hosting Products</span><h2>熱門主機方案</h2></div>
          <ProductGrid products={products.slice(0, 3)} navigate={navigate} />
          <div className="section-actions"><button className="secondary dark-text" onClick={() => navigate('/products')}>查看全部產品</button></div>
        </div>
      </section>
      <section className="container split-section media-feature">
        <div className="server-photo"><img src="/assets/homepage-slide-2.png" alt="香港雲伺服器全球網絡鏈路" /></div>
        <div className="split-copy">
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
      <section className="testimonial-band">
        <div className="container">
          <div className="testimonial-head">
            <div className="section-title"><span>Reviews</span><h2>客戶怎樣評價極雲</h2></div>
            <div className="testimonial-controls">
              <button aria-label="上一組評價" onClick={() => goTestimonial(-1)}><ChevronLeft size={20} /></button>
              <button aria-label="下一組評價" onClick={() => goTestimonial(1)}><ChevronRight size={20} /></button>
            </div>
          </div>
          <div className="testimonial-window">
            <div className="testimonial-track" key={testimonialIndex}>
              {visibleTestimonials.map(([name, text, tag]) => (
                <article key={name}>
                  <span>{tag}</span>
                  <p>{text}</p>
                  <strong>{name}</strong>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <ServiceStrip />
    </main>
  );
}

function ProductsPage({ products, navigate }) {
  return (
    <main>
      <section className="page-hero product-hero">
        <div className="container">
          <h1>產品中心</h1>
          <p>集中查看可售雲伺服器、高防及託管方案。這裏負責了解配置與價格，實際下單會進入伺服器購買頁。</p>
        </div>
      </section>
      <section className="container section">
        <div className="section-title"><span>Products</span><h2>全部可售方案</h2></div>
        <ProductGrid products={products} navigate={navigate} />
      </section>
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
  const orderAmount = product ? (cycle === 'yearly' ? product.priceYearly : product.priceMonthly) : 0;

  useEffect(() => {
    if (!productId && products[0]) setProductId(products[0].id);
  }, [products, productId]);

  const createOrder = async () => {
    if (!user) {
      navigate('/client?auth=login');
      return;
    }
    if (Number(user.balance || 0) < Number(orderAmount || 0)) {
      setNotice(`余额不足：当前余额 ${formatMoney(user.balance)}，本次需 ${formatMoney(orderAmount)}。请先联系管理员充值后再提交订单。`);
      return;
    }
    try {
      const order = await api('/api/orders', { method: 'POST', body: { productId: product.id, cycle } });
      setNotice(`订单 ${order.orderNo || '-'} 已创建，请在客户后台完成余额支付。`);
      navigate('/client?section=orders');
    } catch (error) {
      setNotice(error.message);
    }
  };

  if (!product) return <main className="container section"><h1>暂无可售产品</h1></main>;

  return (
    <main className="buy-page">
      <section className="page-hero"><div className="container"><span className="eyebrow">Server Purchase</span><h1>{hk.buyTitle}</h1><p>產品、價格與庫存均來自後端 API，下單後可在客戶後台完成余额支付。</p></div></section>
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
          <div className="total"><span>合計</span><strong>{formatMoney(orderAmount)}</strong></div>
          <button className="primary wide" onClick={createOrder}><ShoppingCart size={18} />提交訂單</button>
          <p>{user ? `当前余额 ${formatMoney(user.balance)}，余额不足时不会创建订单。` : '請先登入或註冊客戶賬號。'}</p>
        </aside>
      </section>
    </main>
  );
}

function ClientPortal(props) {
  if (!props.user) return <AuthPage {...props} />;
  return <ClientDashboard {...props} />;
}

function AuthPage({ refreshUser, setNotice, route }) {
  const authQuery = new URLSearchParams(route.split('?')[1] || '').get('auth');
  const [mode, setMode] = useState(authQuery === 'register' ? 'register' : 'login');
  const [form, setForm] = useState({ username: '', email: '', account: '', password: '' });
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  useEffect(() => {
    const nextMode = new URLSearchParams(route.split('?')[1] || '').get('auth');
    if (nextMode === 'register') setMode('register');
    else setMode('login');
  }, [route]);
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
            <label htmlFor="client-username">用户名<input id="client-username" name="username" autoComplete="off" value={form.username} onChange={(event) => update('username', event.target.value)} required /></label>
            <label htmlFor="client-email">邮箱<input id="client-email" name="email" autoComplete="off" value={form.email} onChange={(event) => update('email', event.target.value)} required /></label>
          </>
        ) : <label htmlFor="client-account">账号<input id="client-account" name="account" autoComplete="off" value={form.account} onChange={(event) => update('account', event.target.value)} required /></label>}
        <label htmlFor="client-password">密码<input id="client-password" name="password" autoComplete="new-password" type="password" value={form.password} onChange={(event) => update('password', event.target.value)} required /></label>
        <button className="primary wide" type="submit">{mode === 'login' ? '登 录' : '注 册'}</button>
        <div className="login-foot"><span>{mode === 'login' ? '没有账号？' : '已有账号？'}</span><button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? '注册' : '登录'}</button></div>
      </form>
    </main>
  );
}

function ClientDashboard({ user, navigate, setNotice, refreshUser, route }) {
  const routeQuery = new URLSearchParams(route.split('?')[1] || '');
  const [section, setSection] = useState(routeQuery.has('tickets') ? 'tickets' : routeQuery.get('section') || 'overview');
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
  useEffect(() => {
    const query = new URLSearchParams(route.split('?')[1] || '');
    if (query.has('tickets')) setSection('tickets');
    else if (query.get('section')) setSection(query.get('section'));
  }, [route]);
  useEffect(() => { load().catch((error) => setNotice(error.message)); }, [section]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load().catch(() => {});
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

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
        <div className="dashboard-head">
          <div><span className="eyebrow">Client Console</span><h1>{hk.consoleTitle}</h1></div>
          <div className="dashboard-actions">
            <button className="table-action" onClick={() => load().catch((error) => setNotice(error.message))}>刷新</button>
            <button className="primary" onClick={() => navigate('/buy')}><Plus size={18} />購買伺服器</button>
          </div>
        </div>
        {section === 'overview' && (
          <>
            <div className="metric-grid">
              <Metric icon={<Server />} label="服务器" value={data.summary?.servers || 0} />
              <Metric icon={<ReceiptText />} label="订单" value={data.summary?.orders || 0} />
              <Metric icon={<CreditCard />} label="余额" value={formatMoney(user.balance)} />
              <Metric icon={<Bell />} label="未读通知" value={data.summary?.unreadNotifications || 0} />
            </div>
            <div className="two-col">
              <Panel title="最近订单"><Rows rows={data.orders.slice(0, 6).map((order) => ({ left: order.orderNo, mid: formatMoney(order.amount), right: payStatusLabels[order.payStatus] || order.payStatus, action: order.payStatus === 'unpaid' ? <button className="table-action" onClick={() => pay(order.id)}>余额支付</button> : null }))} /></Panel>
              <Panel title="最近通知"><Rows rows={data.notifications.slice(0, 6).map((item) => ({ left: item.title, mid: item.content, right: item.readAt ? '已读' : '未读' }))} /></Panel>
            </div>
          </>
        )}
        {section === 'servers' && <Panel title="我的服务器"><DataTable columns={['名称', 'IP', '系统', '登录', '到期时间', '状态', '操作']} rows={data.servers.map((server) => [server.name, server.ip, server.os, `${server.loginUser} / ${server.loginPassword}`, formatDate(server.expiresAt), <StatusPill value={server.status} labels={serverStatusLabels} />, <button className="table-action" onClick={() => renew(server.id)}>续费</button>])} /></Panel>}
        {section === 'orders' && <Panel title="订单记录"><DataTable columns={['订单', '产品与消息', '类型', '金额', '支付状态', '开通状态', '操作']} rows={data.orders.map((order) => [
          <OrderNumberCell order={order} />,
          <OrderProductCell order={order} />,
          orderTypeLabels[order.type] || order.type,
          formatMoney(order.amount),
          <StatusPill value={order.payStatus} labels={payStatusLabels} />,
          <StatusPill value={order.provisionStatus} labels={provisionStatusLabels} />,
          order.payStatus === 'unpaid' ? <button className="table-action" onClick={() => pay(order.id)}>余额支付</button> : '-'
        ])} /></Panel>}
        {section === 'tickets' && (
          <div className="two-col">
            <Panel title="提交工单"><form className="admin-form ticket-form" onSubmit={submitTicket}><input placeholder="标题" value={ticket.title} onChange={(event) => setTicket((prev) => ({ ...prev, title: event.target.value }))} required /><input placeholder="内容" value={ticket.content} onChange={(event) => setTicket((prev) => ({ ...prev, content: event.target.value }))} required /><button className="primary" type="submit">提交</button></form></Panel>
            <Panel title="工单列表"><Rows rows={data.tickets.map((item) => ({ left: item.title, mid: formatDate(item.updatedAt), right: <StatusPill value={item.status} labels={ticketStatusLabels} /> }))} /></Panel>
          </div>
        )}
        {section === 'wallet' && <Panel title="余额流水"><Rows rows={data.wallet.map((item) => ({ left: item.remark || item.type, mid: formatMoney(item.amount), right: formatMoney(item.balanceAfter) }))} /></Panel>}
        {section === 'notifications' && <Panel title="站内通知"><DataTable columns={['通知', '关联订单', '内容', '时间', '状态']} rows={data.notifications.map((item) => [
          <NotificationTitle item={item} />,
          item.order?.orderNo || '-',
          <div className="message-preview notification-content"><span>{item.content}</span></div>,
          formatDate(item.createdAt),
          item.readAt ? '已读' : '未读'
        ])} /></Panel>}
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
    <main className="admin-login-page">
      <div className="admin-login-visual">
        <div className="admin-login-mark"><Settings size={30} /></div>
        <h1>运营管理后台</h1>
        <p>订单、产品、客户、服务器、财务流水和工单集中处理。</p>
      </div>
      <form className="login-form-card admin-login-card" onSubmit={submit} autoComplete="off">
        <h2>管理员登录</h2><p>请输入后台管理员账号和密码</p>
        <label htmlFor="admin-username">账户<input id="admin-username" name="username" autoComplete="off" value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} /></label>
        <label htmlFor="admin-password">密码<input id="admin-password" name="password" autoComplete="new-password" type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} /></label>
        <button className="primary wide" type="submit">登 录</button>
      </form>
    </main>
  );
}

function AdminDashboard({ admin, navigate, refreshAdmin, setNotice, refreshProducts, refreshSiteSettings }) {
  const [section, setSection] = useState('dashboard');
  const [adminFilter, setAdminFilter] = useState('');
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [data, setData] = useState({ summary: {}, users: [], products: [], orders: [], servers: [], tickets: [], logs: [], settings: [] });
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [serverForm, setServerForm] = useState({ orderId: '', name: '', ip: '', os: 'Ubuntu 22.04', loginUser: 'root', loginPassword: '', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) });
  const [rechargeForm, setRechargeForm] = useState({ open: false, user: null, amount: '', remark: '' });
  const [replyForm, setReplyForm] = useState({ open: false, ticket: null, content: '' });
  const [userForm, setUserForm] = useState({ open: false, user: null, email: '', phone: '', status: 'active' });
  const [productEditForm, setProductEditForm] = useState({ open: false, product: null, values: emptyProductForm });
  const [serverEditForm, setServerEditForm] = useState({ open: false, server: null, values: {} });
  const [passwordForm, setPasswordForm] = useState({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' });
  const [orderMessageForm, setOrderMessageForm] = useState({ open: false, order: null, content: '' });
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

  const formatJobResult = (result) => {
    const expiring = result.expiring?.scanned || 0;
    const notices = result.expiring?.notifications || 0;
    const expired = result.expired?.expired || 0;
    const suspended = result.expired?.suspended || 0;
    const cancelled = result.orders?.cancelled || 0;
    const tokens = result.tokens?.cleaned || 0;
    return `定时任务已完成：检查即将到期 ${expiring} 台，生成提醒 ${notices} 条，标记过期 ${expired} 台，暂停 ${suspended} 台，取消未支付订单 ${cancelled} 个，清理代登录 token ${tokens} 个。`;
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

  const openProductEdit = (product) => setProductEditForm({
    open: true,
    product,
    values: {
      name: product.name || '',
      type: product.type || '',
      location: product.location || '',
      cpu: product.cpu || '',
      memory: product.memory || '',
      disk: product.disk || '',
      bandwidth: product.bandwidth || '',
      defense: product.defense || '',
      priceMonthly: moneyInput(product.priceMonthly),
      priceYearly: moneyInput(product.priceYearly),
      stock: String(product.stock ?? 0),
      description: product.description || ''
    }
  });

  const submitProductEdit = async (event) => {
    event.preventDefault();
    if (!productEditForm.product) return;
    try {
      await api(`/api/admin/products/${productEditForm.product.id}`, { method: 'PUT', body: productEditForm.values });
      setProductEditForm({ open: false, product: null, values: emptyProductForm });
      await load();
      await refreshProducts();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const openUserEdit = (user) => setUserForm({ open: true, user, email: user.email || '', phone: user.phone || '', status: user.status || 'active' });

  const submitUserEdit = async (event) => {
    event.preventDefault();
    if (!userForm.user) return;
    try {
      await api(`/api/admin/users/${userForm.user.id}`, { method: 'PUT', body: { email: userForm.email, phone: userForm.phone, status: userForm.status } });
      setUserForm({ open: false, user: null, email: '', phone: '', status: 'active' });
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const setUserStatus = async (user, status) => {
    try {
      await api(`/api/admin/users/${user.id}/${status === 'active' ? 'enable' : 'disable'}`, { method: 'POST' });
      await load();
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

  const orderAction = async (order, action) => {
    try {
      await api(`/api/admin/orders/${order.id}/${action}`, { method: 'POST' });
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const openProvisionFromOrder = (order) => {
    setServerForm((prev) => ({
      ...prev,
      orderId: order.id,
      name: order.product?.name || order.orderNo,
      os: prev.os || 'Linux',
      loginUser: prev.loginUser || 'root'
    }));
    setSection('servers');
    setNotice(`已选择待开通订单 ${order.orderNo}，请补充 IP 和密码后开通`);
  };

  const submitOrderMessage = async (event) => {
    event.preventDefault();
    if (!orderMessageForm.order) return;
    try {
      await api(`/api/admin/orders/${orderMessageForm.order.id}/message`, {
        method: 'POST',
        body: { content: orderMessageForm.content }
      });
      setOrderMessageForm({ open: false, order: null, content: '' });
      setNotice('订单消息已发送给用户');
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

  const openServerEdit = (server) => setServerEditForm({
    open: true,
    server,
    values: {
      name: server.name || '',
      ip: server.ip || '',
      os: server.os || '',
      loginUser: server.loginUser || '',
      loginPassword: '',
      panelUrl: server.panelUrl || '',
      status: server.status || 'running',
      expiresAt: dateInput(server.expiresAt)
    }
  });

  const submitServerEdit = async (event) => {
    event.preventDefault();
    if (!serverEditForm.server) return;
    try {
      await api(`/api/admin/servers/${serverEditForm.server.id}`, { method: 'PUT', body: serverEditForm.values });
      setServerEditForm({ open: false, server: null, values: {} });
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const serverAction = async (server, action, body = null) => {
    try {
      await api(`/api/admin/servers/${server.id}/${action}`, { method: 'POST', body });
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
    setNotice(formatJobResult(result));
    await load();
  };

  const submitAdminPassword = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setNotice('两次输入的新密码不一致');
      return;
    }
    try {
      await api('/api/admin/auth/change-password', {
        method: 'POST',
        body: { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }
      });
      setPasswordForm({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' });
      setNotice('管理员密码已修改');
    } catch (error) {
      setNotice(error.message);
    }
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

  const closeTicket = async (ticket) => {
    try {
      await api(`/api/admin/tickets/${ticket.id}/close`, { method: 'POST' });
      await load();
    } catch (error) {
      setNotice(error.message);
    }
  };

  const pendingPaidOrders = data.orders.filter((order) => order.payStatus === 'paid' && order.provisionStatus !== 'opened' && order.type === 'new_server');

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <button className="admin-brand" onClick={() => navigate('/')} title="返回网站首页"><Cloud size={24} /><strong>主机管理系统</strong></button>
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
        <div className="admin-top">
          <label className="admin-search" htmlFor="admin-global-search"><Search size={17} /><input id="admin-global-search" name="adminSearch" value={adminFilter} onChange={(event) => setAdminFilter(event.target.value)} placeholder="搜索订单号 / 用户 / 产品 / IP / 工单" /></label>
          <button className="icon-btn" onClick={() => setSection('tickets')} title="查看待处理工单"><Bell size={18} /></button>
          <div className="admin-user-menu">
            <button className="admin-user" onClick={() => setAdminMenuOpen((value) => !value)}><User size={17} />{admin.username}</button>
            {adminMenuOpen && (
              <div className="admin-dropdown">
                <strong>{admin.name || admin.username}</strong>
                <span>{admin.role || 'administrator'}</span>
                <button onClick={() => { setSection('logs'); setAdminMenuOpen(false); }}>系统设置</button>
                <button onClick={() => { setSection('tickets'); setAdminMenuOpen(false); }}>工单处理</button>
                <button onClick={() => { setPasswordForm({ open: true, currentPassword: '', newPassword: '', confirmPassword: '' }); setAdminMenuOpen(false); }}>修改密码</button>
                <button onClick={logout}>退出登录</button>
              </div>
            )}
          </div>
        </div>
        {section === 'dashboard' && <AdminSummary summary={data.summary} runJobs={runJobs} />}
        {section === 'products' && <AdminProducts products={data.products} keyword={adminFilter} form={productForm} setForm={setProductForm} addProduct={addProduct} updateProductStatus={updateProductStatus} openProductEdit={openProductEdit} />}
        {section === 'orders' && <AdminOrders orders={data.orders} keyword={adminFilter} markPaid={markPaid} orderAction={orderAction} openOrderMessage={(order) => setOrderMessageForm({ open: true, order, content: '' })} openProvision={openProvisionFromOrder} />}
        {section === 'servers' && <AdminServers servers={data.servers} keyword={adminFilter} orders={pendingPaidOrders} form={serverForm} setForm={setServerForm} openServer={openServer} openServerEdit={openServerEdit} serverAction={serverAction} />}
        {section === 'users' && <AdminUsers users={data.users} keyword={adminFilter} openUserEdit={openUserEdit} openRecharge={(user) => setRechargeForm({ open: true, user, amount: '', remark: '后台手动充值' })} setUserStatus={setUserStatus} impersonate={impersonate} />}
        {section === 'tickets' && <AdminTickets tickets={data.tickets} keyword={adminFilter} openReply={(ticket) => setReplyForm({ open: true, ticket, content: '' })} closeTicket={closeTicket} />}
        {section === 'logs' && <AdminLogs logs={data.logs} keyword={adminFilter} settings={data.settings} settingsForm={settingsForm} setSettingsForm={setSettingsForm} saveSettings={saveSettings} />}
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
        {userForm.open && (
          <Modal title={`编辑用户：${userForm.user.username}`} onClose={() => setUserForm({ open: false, user: null, email: '', phone: '', status: 'active' })}>
            <form className="modal-form" onSubmit={submitUserEdit}>
              <label>邮箱<input value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} required /></label>
              <label>电话<input value={userForm.phone} onChange={(event) => setUserForm((prev) => ({ ...prev, phone: event.target.value }))} /></label>
              <label>状态<select value={userForm.status} onChange={(event) => setUserForm((prev) => ({ ...prev, status: event.target.value }))}><option value="active">正常</option><option value="disabled">已禁用</option></select></label>
              <button className="primary" type="submit">保存用户</button>
            </form>
          </Modal>
        )}
        {productEditForm.open && (
          <Modal title={`编辑产品：${productEditForm.product.name}`} onClose={() => setProductEditForm({ open: false, product: null, values: emptyProductForm })}>
            <ProductFields form={productEditForm.values} setForm={(updater) => setProductEditForm((prev) => ({ ...prev, values: typeof updater === 'function' ? updater(prev.values) : updater }))} submitLabel="保存产品" onSubmit={submitProductEdit} />
          </Modal>
        )}
        {serverEditForm.open && (
          <Modal title={`编辑服务器：${serverEditForm.server.name}`} onClose={() => setServerEditForm({ open: false, server: null, values: {} })}>
            <form className="modal-form" onSubmit={submitServerEdit}>
              <label>名称<input value={serverEditForm.values.name || ''} onChange={(event) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, name: event.target.value } }))} required /></label>
              <label>IP<input value={serverEditForm.values.ip || ''} onChange={(event) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, ip: event.target.value } }))} required /></label>
              <label>系统<input value={serverEditForm.values.os || ''} onChange={(event) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, os: event.target.value } }))} /></label>
              <label>登录用户<input value={serverEditForm.values.loginUser || ''} onChange={(event) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, loginUser: event.target.value } }))} /></label>
              <label>新密码<input type="password" value={serverEditForm.values.loginPassword || ''} onChange={(event) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, loginPassword: event.target.value } }))} placeholder="不填写则不修改" /></label>
              <label>面板地址<input value={serverEditForm.values.panelUrl || ''} onChange={(event) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, panelUrl: event.target.value } }))} /></label>
              <label>状态<select value={serverEditForm.values.status || 'running'} onChange={(event) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, status: event.target.value } }))}><option value="running">运行中</option><option value="suspended">已暂停</option><option value="expired">已到期</option><option value="expiring">即将到期</option></select></label>
              <label>到期时间<input type="date" value={serverEditForm.values.expiresAt || ''} onChange={(event) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, expiresAt: event.target.value } }))} /></label>
              <button className="primary" type="submit">保存服务器</button>
            </form>
          </Modal>
        )}
        {orderMessageForm.open && (
          <Modal title={`发送订单消息：${orderMessageForm.order.orderNo}`} onClose={() => setOrderMessageForm({ open: false, order: null, content: '' })}>
            <form className="modal-form" onSubmit={submitOrderMessage}>
              <label>用户<input value={orderMessageForm.order.user?.username || '-'} readOnly /></label>
              <label>订单<input value={`${orderMessageForm.order.product?.name || '-'} / ${formatMoney(orderMessageForm.order.amount)}`} readOnly /></label>
              <label>消息内容<textarea value={orderMessageForm.content} onChange={(event) => setOrderMessageForm((prev) => ({ ...prev, content: event.target.value }))} placeholder="例如：您的订单已进入开通队列，预计 10 分钟内交付。" required /></label>
              <button className="primary" type="submit"><MessageSquare size={17} />发送给用户</button>
            </form>
          </Modal>
        )}
        {passwordForm.open && (
          <Modal title="修改管理员密码" onClose={() => setPasswordForm({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' })}>
            <form className="modal-form" onSubmit={submitAdminPassword}>
              <label htmlFor="admin-current-password">当前密码<input id="admin-current-password" name="currentPassword" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))} required /></label>
              <label htmlFor="admin-new-password">新密码<input id="admin-new-password" name="newPassword" type="password" autoComplete="new-password" minLength="6" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))} required /></label>
              <label htmlFor="admin-confirm-password">确认新密码<input id="admin-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength="6" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))} required /></label>
              <button className="primary" type="submit">保存新密码</button>
            </form>
          </Modal>
        )}
      </section>
    </main>
  );
}

function AdminSummary({ summary, runJobs }) {
  const daily = summary.daily || [];
  const maxValue = Math.max(1, ...daily.map((item) => Math.max(item.orders, Math.round((item.income || 0) / 100))));
  return (
    <div className="admin-page">
      <div className="dashboard-head"><h1>控制台</h1><button className="primary" onClick={runJobs}>运行定时任务</button></div>
      <div className="admin-metrics">
        <Metric icon={<Users />} label="用户数" value={summary.users || 0} />
        <Metric icon={<Server />} label="服务器" value={summary.servers || 0} />
        <Metric icon={<ReceiptText />} label="订单数" value={summary.orders || 0} />
        <Metric icon={<CircleDollarSign />} label="营业额" value={formatMoney(summary.income || 0)} />
      </div>
      <div className="metric-grid ops-grid">
        <Metric icon={<ReceiptText />} label="待支付订单" value={summary.unpaidOrders || 0} />
        <Metric icon={<PackagePlus />} label="待开通订单" value={summary.paidPendingOrders || 0} />
        <Metric icon={<Bell />} label="即将到期服务器" value={summary.expiringServers || 0} />
        <Metric icon={<Ticket />} label="待处理工单" value={summary.openTickets || 0} />
      </div>
      <Panel title="近 7 天业务概览">
        <div className="chart-bars">
          {daily.map((day) => {
            const orderHeight = Math.max(4, (day.orders / maxValue) * 100);
            const incomeHeight = Math.max(4, ((day.income / 100) / maxValue) * 100);
            return (
              <div className="chart-day" key={day.date}>
                <div className="chart-stack"><i className="orders" style={{ height: `${orderHeight}%` }} /><i className="income" style={{ height: `${incomeHeight}%` }} /></div>
                <strong>{day.orders} 单</strong>
                <span>{formatMoney(day.income)}</span>
                <em>{day.date.slice(5)}</em>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function ProductFields({ form, setForm, onSubmit, submitLabel }) {
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <form className="admin-form product-form" onSubmit={onSubmit}>
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
      <button className="primary" type="submit"><Plus size={17} />{submitLabel}</button>
    </form>
  );
}

function AdminProducts({ products, keyword, form, setForm, addProduct, updateProductStatus, openProductEdit }) {
  const rows = products.filter((product) => [product.name, product.type, product.location, product.cpu, product.memory, product.disk, product.bandwidth, product.status].some((value) => textIncludes(value, keyword)));
  return (
    <div className="admin-page">
      <h1>产品管理</h1>
      <Panel title="新增购买方案"><ProductFields form={form} setForm={setForm} submitLabel="新增" onSubmit={addProduct} /></Panel>
      <DataTable columns={['产品名称', '类型', '地区', '配置', '月付', '年付', '库存', '状态', '操作']} rows={rows.map((product) => [
        product.name,
        product.type,
        product.location,
        `${product.cpu} / ${product.memory} / ${product.disk}`,
        formatMoney(product.priceMonthly),
        formatMoney(product.priceYearly),
        product.stock,
        <StatusPill value={product.status} labels={productStatusLabels} />,
        <ActionGroup actions={[
          ['编辑', () => openProductEdit(product)],
          [product.status === 'on_sale' ? '下架' : '上架', () => updateProductStatus(product, product.status === 'on_sale' ? 'off_sale' : 'on_sale')]
        ]} />
      ])} />
    </div>
  );
}

function AdminOrders({ orders, keyword, markPaid, orderAction, openOrderMessage, openProvision }) {
  const rows = orders.filter((order) => [order.orderNo, order.user?.username, order.product?.name, order.type, order.payStatus, order.provisionStatus].some((value) => textIncludes(value, keyword)));
  return (
    <div className="admin-page">
      <h1>订单管理</h1>
      <DataTable columns={['订单', '客户', '产品与消息', '类型', '金额', '支付', '开通', '操作']} rows={rows.map((order) => [
        <OrderNumberCell order={order} />,
        <UserIdentity user={order.user} compact />,
        <OrderProductCell order={order} />,
        orderTypeLabels[order.type] || order.type,
        formatMoney(order.amount),
        <StatusPill value={order.payStatus} labels={payStatusLabels} />,
        <StatusPill value={order.provisionStatus} labels={provisionStatusLabels} />,
        <ActionGroup actions={[
          ...(order.payStatus === 'paid' && order.provisionStatus === 'pending' && order.type === 'new_server' ? [['开通服务器', () => openProvision(order)]] : []),
          ['发消息', () => openOrderMessage(order)],
          ...(order.payStatus === 'unpaid' ? [['确认支付', () => markPaid(order.id)], ['取消', () => orderAction(order, 'cancel')]] : []),
          ...(order.payStatus === 'paid' ? [['退款', () => orderAction(order, 'refund')]] : [])
        ]} />
      ])} />
    </div>
  );
}

function AdminServers({ servers, keyword, orders, form, setForm, openServer, openServerEdit, serverAction }) {
  useEffect(() => {
    if (!form.orderId && orders[0]) setForm((prev) => ({ ...prev, orderId: orders[0].id, name: orders[0].product?.name || '' }));
  }, [orders, form.orderId, setForm]);
  const rows = servers.filter((server) => [server.name, server.user?.username, server.ip, server.os, server.status, server.product?.name].some((value) => textIncludes(value, keyword)));
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
      <DataTable columns={['服务器', '用户', 'IP', '系统', '到期', '状态', '操作']} rows={rows.map((server) => [
        server.name,
        server.user?.username,
        server.ip,
        server.os,
        formatDate(server.expiresAt),
        <StatusPill value={server.status} labels={serverStatusLabels} />,
        <ActionGroup actions={[
          ['编辑', () => openServerEdit(server)],
          [server.status === 'suspended' ? '恢复' : '暂停', () => serverAction(server, server.status === 'suspended' ? 'resume' : 'suspend')],
          ['延长1月', () => serverAction(server, 'extend', { cycle: 'monthly' })]
        ]} />
      ])} />
    </div>
  );
}

function AdminUsers({ users, keyword, openUserEdit, openRecharge, setUserStatus, impersonate }) {
  const rows = users.filter((user) => [user.username, user.email, user.phone, user.status].some((value) => textIncludes(value, keyword)));
  return (
    <div className="admin-page">
      <h1>用户管理</h1>
      <DataTable columns={['用户信息', '联系方式', '余额', '业务概况', '状态', '操作']} rows={rows.map((user) => [
        <UserIdentity user={user} />,
        <div className="meta-stack"><span>{user.email}</span><small>{user.phone || '未填写手机号'}</small><small>注册：{formatDate(user.createdAt)}</small></div>,
        <strong className="money-cell">{formatMoney(user.balance)}</strong>,
        <UserBusinessStats user={user} />,
        <StatusPill value={user.status} labels={userStatusLabels} />,
        <ActionGroup actions={[
          ['编辑', () => openUserEdit(user)],
          ['充值', () => openRecharge(user)],
          [user.status === 'active' ? '禁用' : '启用', () => setUserStatus(user, user.status === 'active' ? 'disabled' : 'active')],
          ['代登录', () => impersonate(user.id)]
        ]} />
      ])} />
    </div>
  );
}

function AdminTickets({ tickets, keyword, openReply, closeTicket }) {
  const rows = tickets.filter((ticket) => [ticket.title, ticket.user?.username, ticket.status].some((value) => textIncludes(value, keyword)));
  return (
    <div className="admin-page">
      <h1>工单管理</h1>
      <DataTable columns={['工单', '用户', '状态', '更新时间', '最近内容', '操作']} rows={rows.map((ticket) => [
        <TicketTitleCell ticket={ticket} />,
        <UserIdentity user={ticket.user} compact />,
        <StatusPill value={ticket.status} labels={ticketStatusLabels} />,
        formatDate(ticket.updatedAt),
        <TicketLastReply ticket={ticket} />,
        <ActionGroup actions={[
          ['回复', () => openReply(ticket)],
          ...(ticket.status !== 'closed' ? [['关闭', () => closeTicket(ticket)]] : [])
        ]} />
      ])} />
    </div>
  );
}

function AdminLogs({ logs, keyword, settings, settingsForm, setSettingsForm, saveSettings }) {
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
  const rows = logs.filter((log) => [log.action, log.targetType, log.targetId, log.admin?.username, log.detail].some((value) => textIncludes(value, keyword)));
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
      <DataTable columns={['动作', '目标', '管理员', '时间', '详情']} rows={rows.map((log) => [log.action, `${log.targetType}:${log.targetId || '-'}`, log.admin?.username || '-', formatDate(log.createdAt), log.detail || '-'])} />
    </div>
  );
}

function UserIdentity({ user, compact = false }) {
  if (!user) return '-';
  return (
    <div className={`identity-cell ${compact ? 'compact' : ''}`}>
      <span className="identity-avatar">{user.username?.slice(0, 1).toUpperCase() || 'U'}</span>
      <span><strong>{user.username}</strong><small>ID {user.id?.slice(-6) || '-'}</small></span>
    </div>
  );
}

function UserBusinessStats({ user }) {
  const count = user._count || {};
  return (
    <div className="compact-stats">
      <span><strong>{count.orders || 0}</strong> 订单</span>
      <span><strong>{count.servers || 0}</strong> 服务器</span>
      <span><strong>{count.tickets || 0}</strong> 工单</span>
      <span><strong>{count.notifications || 0}</strong> 通知</span>
    </div>
  );
}

function OrderNumberCell({ order }) {
  return (
    <div className="meta-stack order-number-cell">
      <strong>{order.orderNo}</strong>
      <small>{formatDate(order.createdAt)}</small>
    </div>
  );
}

function OrderProductCell({ order }) {
  const messages = order.notifications || [];
  const visibleMessages = [
    ...messages.filter((item) => item.type === 'order_message'),
    ...messages.filter((item) => item.type !== 'order_message')
  ].slice(0, 2);
  return (
    <div className="order-product-cell">
      <strong>{order.product?.name || '-'}</strong>
      {order.server?.ip && <small>关联服务器：{order.server.ip}</small>}
      {visibleMessages.length ? (
        <div className="message-list">
          {visibleMessages.map((message) => (
            <div className="message-preview" key={message.id}>
              <MessageSquare size={14} />
              <span>{message.content}</span>
            </div>
          ))}
          {messages.length > visibleMessages.length && <em className="message-more">+{messages.length - visibleMessages.length}</em>}
        </div>
      ) : <small>暂无订单消息</small>}
    </div>
  );
}

function NotificationTitle({ item }) {
  return (
    <div className="meta-stack">
      <strong>{item.title}</strong>
      <small>{item.type === 'order_message' ? '订单消息' : item.type === 'server_opened' ? '开通通知' : item.type === 'ticket_reply' ? '工单回复' : item.type}</small>
    </div>
  );
}

function TicketTitleCell({ ticket }) {
  return (
    <div className="meta-stack">
      <strong>{ticket.title}</strong>
      <small>分类：{ticket.category || 'support'} · 创建：{formatDate(ticket.createdAt)}</small>
    </div>
  );
}

function latestReply(ticket) {
  return [...(ticket.replies || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
}

function TicketLastReply({ ticket }) {
  const reply = latestReply(ticket);
  if (!reply) return '-';
  return (
    <div className="message-preview ticket-preview">
      <span>{reply.content}</span>
      <em>{reply.senderType === 'admin' ? '后台' : '用户'} · {formatDate(reply.createdAt)}</em>
    </div>
  );
}

function ActionGroup({ actions }) {
  const activeActions = actions.filter(Boolean);
  if (!activeActions.length) return '-';
  return <div className="action-group">{activeActions.map(([label, onClick]) => <button className="table-action" key={label} onClick={onClick}>{label}</button>)}</div>;
}

function StatusPill({ value, labels }) {
  return <span className={`status-pill ${value || 'unknown'}`}>{labels[value] || value || '-'}</span>;
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
          <tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>) : <tr><td colSpan={columns.length} className="empty-cell">暂无数据</td></tr>}</tbody>
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

function PublicFooter({ siteSettings, navigate }) {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div><div className="footer-brand"><Cloud size={26} />{siteSettings.site_name}</div><p>專業互聯網基礎服務提供商，香港伺服器、美國伺服器及 VPS 服務商。</p></div>
        <div><h3>產品中心</h3><a>雲伺服器</a><a>伺服器租用</a><a>伺服器託管</a></div>
        <div><h3>服務支援</h3><a>服務條款</a><a>私隱政策</a><button className="footer-link" onClick={() => navigate('/client?tickets')}>提交工單</button></div>
        <div><h3>聯絡我們</h3><p>中國·香港</p><p>{siteSettings.support_phone}</p><p>{siteSettings.support_email}</p></div>
      </div>
      <div className="copyright">{siteSettings.copyright}</div>
    </footer>
  );
}

createRoot(document.getElementById('root')).render(<App />);
