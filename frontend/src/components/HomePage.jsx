import React, { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import CountUp from 'react-countup';
import {
  Boxes, Check, ChevronLeft, ChevronRight, Cloud, Database,
  Globe2, HardDrive, Headphones, LockKeyhole,
  Server, ShieldCheck, ShoppingCart, Zap
} from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { A11y, Autoplay, EffectFade, Keyboard, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { hk, formatMoney } from '../utils';

gsap.registerPlugin(ScrollTrigger);

function HeroCarousel({ heroSlides, navigate, hk }) {
  const scope = useRef(null);

  const runInitialHeroAnimation = (swiper) => {
    const activeSlide = swiper?.slides?.[swiper.activeIndex];
    if (!activeSlide) return;

    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const c = activeSlide.querySelector('.home-hero-content');
      if (!c) return;

      const tl = gsap.timeline();
      tl.fromTo(c.querySelector('.home-hero-kicker'),
        { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
      tl.fromTo(c.querySelector('h1'),
        { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, '-=0.2');
      tl.fromTo(c.querySelector('p'),
        { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out' }, '-=0.22');
      tl.fromTo(c.querySelectorAll('.home-hero-stats > div'),
        { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power3.out' }, '-=0.15');
      tl.fromTo(c.querySelector('.home-hero-actions'),
        { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, '-=0.12');
    });
  };

  return (
    <section className="home-hero" ref={scope}>
      <Swiper
        modules={[Autoplay, EffectFade, Navigation, Pagination, A11y, Keyboard]}
        effect="fade"
        autoplay={{ delay: 5200, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        navigation={true}
        keyboard={{ enabled: true }}
        loop={true}
        className="home-hero-swiper"
        onSwiper={(s) => { requestAnimationFrame(() => runInitialHeroAnimation(s)); }}
      >
        {heroSlides.map((slide, index) => (
          <SwiperSlide key={index}>
            <div className="home-hero-bg">
              <img src={slide.image} alt={slide.title} className="home-hero-img" />
              <div className="home-hero-overlay"></div>
            </div>
            <div className="home-hero-container">
              <div className="home-hero-content">
                <span className="home-hero-kicker">{slide.kicker}</span>
                <h1>
                  {slide.title.includes('伺服器')
                    ? slide.title.split('伺服器').reduce((acc, part, i) =>
                        i === 0 ? [part] : [...acc, <span key={i}>伺服器</span>, part]
                      , [])
                    : slide.title}
                </h1>
                <p>{slide.text}</p>
                <div className="home-hero-stats">
                  {slide.stats.map((stat, i) => (
                    <div key={i}>
                      <strong>{stat.value}{stat.suffix && <span>{stat.suffix}</span>}</strong>
                      <span>{stat.label}</span>
                    </div>
                  ))}
                </div>
                <div className="home-hero-actions">
                  <button className="home-btn-primary" onClick={() => navigate('/buy')}>
                    <ShoppingCart size={18} />{hk.primaryCta}
                  </button>
                  <button className="home-btn-secondary" onClick={() => navigate('/client')}>
                    {hk.secondaryCta}
                  </button>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
}

function StatsStrip({ siteSettings }) {
  const scope = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.home-stat-item', {
        scrollTrigger: { trigger: scope.current, start: 'top 85%' },
        opacity: 0, y: 24, duration: 0.6, stagger: 0.12, ease: 'power2.out'
      });
    });
    return () => mm.revert();
  }, { scope });

  const stats = [
    { label: '香港優化線路', value: 2, suffix: '', prefix: 'CN2 / BGP' },
    { label: '庫存總量', value: 42, suffix: '+', prefix: '' },
    { label: '工單與運維', value: 7, suffix: 'x24', prefix: '' },
    { label: '密碼加密', value: 256, suffix: 'bit', prefix: 'AES-' },
  ];

  return (
    <div className="home-stats" ref={scope}>
      <div className="home-stats-grid">
        {stats.map((item) => (
          <div className="home-stat-item" key={item.label}>
            <strong>
              {item.prefix && <span>{item.prefix}</span>}
              <CountUp end={item.value} duration={2.5} enableScrollSpy scrollSpyOnce />
              {item.suffix && <span>{item.suffix}</span>}
            </strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductShowcase({ products, navigate }) {
  const scope = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.home-product-card', {
        scrollTrigger: { trigger: scope.current, start: 'top 82%' },
        opacity: 0, y: 36, duration: 0.65, stagger: 0.14, ease: 'power3.out'
      });
    });
    return () => mm.revert();
  }, { scope });

  return (
    <section className="home-products" ref={scope}>
      <div className="home-section-head">
        <span className="home-eyebrow">Hot Plans</span>
        <h2>熱門主機方案</h2>
        <p>香港 T3+ 數據中心，BGP 多線 + CN2 直連，適合企業網站、跨境電商與 SaaS 業務</p>
      </div>
      <div className="home-products-grid">
        {products.slice(0, 3).map((product) => (
          <article className="home-product-card price-card" key={product.id}>
            <div className="price-image"><Server size={32} /></div>
            <span className="pill">{product.type}</span>
            <h3>{product.name}</h3>
            <p className="home-product-meta">{product.location} / {product.bandwidth}</p>
            <div className="price">起價 <strong>{formatMoney(product.priceMonthly)}</strong><span>/月</span></div>
            <ul>
              {[product.cpu, product.memory, product.disk, product.defense].map((item) => <li key={item}><Check size={16} />{item}</li>)}
            </ul>
            <button className="home-btn-primary wide" onClick={() => navigate(`/buy?product=${product.id}`)}>購買</button>
          </article>
        ))}
      </div>
      <div className="home-section-foot">
        <button className="home-btn-secondary" onClick={() => navigate('/products')}>查看全部產品</button>
      </div>
    </section>
  );
}

function InfrastructureSection({ navigate }) {
  const scope = useRef(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.home-infra-img', {
        scrollTrigger: { trigger: scope.current, start: 'top 70%' },
        scale: 1.06, duration: 1.2, ease: 'power2.out'
      });
      gsap.from('.home-infra-content', {
        scrollTrigger: { trigger: scope.current, start: 'top 70%' },
        opacity: 0, x: -40, duration: 0.9, delay: 0.2, ease: 'power3.out'
      });
    });
    return () => mm.revert();
  }, { scope });

  return (
    <section className="home-infra" ref={scope}>
      <div className="home-infra-inner">
        <div className="home-infra-bg">
          <img
            src="/assets/homepage-platform-infra.png"
            alt="伺服器基礎設施平台"
            className="home-infra-img"
          />
        </div>
        <div className="home-infra-overlay"></div>
        <div className="home-infra-content">
          <span className="home-eyebrow light">Infrastructure</span>
          <h2>強大的伺服器和平台</h2>
          <p>採用多網融合技術、T3+ 數據中心和冗餘保護機制，協助企業穩定拓展線上業務。</p>
          <div className="home-infra-list">
            <div><ShieldCheck size={22} /> 防火牆安全防護</div>
            <div><Globe2 size={22} /> 遍佈全球可用區</div>
            <div><Zap size={22} /> 下單後後台開通交付</div>
          </div>
          <button className="home-btn-primary" onClick={() => navigate('/buy')}>從這裏開始</button>
        </div>
      </div>
    </section>
  );
}

function TestimonialCarousel({ testimonials }) {
  const [swiperRef, setSwiperRef] = React.useState(null);

  const getInitials = (name) => name.charAt(0);

  return (
    <section className="home-testimonials">
      <div className="home-section-head">
        <span className="home-eyebrow">Testimonials</span>
        <h2>客戶怎樣評價極雲</h2>
        <p>來自各行業的真實反饋與信賴</p>
      </div>
      <div className="home-testimonials-stage">
        <button className="home-review-arrow home-review-prev" aria-label="上一组" onClick={() => swiperRef?.slidePrev()}>
          <ChevronLeft size={22} />
        </button>
        <div className="home-testimonials-track">
          <Swiper
            modules={[Autoplay, Pagination, A11y]}
            spaceBetween={24}
            slidesPerView="auto"
            centeredSlides={true}
            loop={true}
            initialSlide={0}
            autoplay={{ delay: 4000, disableOnInteraction: false, pauseOnMouseEnter: true }}
            pagination={{ clickable: true, dynamicBullets: true }}
            onSwiper={setSwiperRef}
            className="home-testimonials-swiper"
          >
            {testimonials.map((item, idx) => (
              <SwiperSlide key={idx}>
                <article className="home-review-card">
                  <div className="home-review-top">
                    <div className="home-review-avatar">{getInitials(item.name)}</div>
                    <div className="home-review-badges">
                      {item.badges.map((b) => (
                        <span key={b} className={`home-review-service-tag ${b.toLowerCase()}`}>{b}</span>
                      ))}
                    </div>
                  </div>
                  <blockquote className="home-review-text">"{item.text}"</blockquote>
                  <div className="home-review-footer">
                    <div>
                      <strong>{item.name}</strong>
                    </div>
                    <span className="home-review-tag">{item.tag}</span>
                  </div>
                </article>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
        <button className="home-review-arrow home-review-next" aria-label="下一组" onClick={() => swiperRef?.slideNext()}>
          <ChevronRight size={22} />
        </button>
      </div>
    </section>
  );
}

export function ServiceStrip() {
  const items = [
    ['雲伺服器', Cloud],
    ['伺服器租用', Server],
    ['伺服器託管', Database],
    ['域名註冊', Globe2],
    ['SSL 證書', LockKeyhole],
    ['CDN 加速', Zap],
    ['數據備份', HardDrive],
    ['解決方案', Boxes]
  ];
  return (
    <section className="home-services">
      <div className="home-services-grid">
        {items.map(([item, Icon], index) => (
          <article key={item} className="home-service-card">
            <div className="home-service-icon"><Icon size={20} /></div>
            <h3>{item}</h3>
            <p>{index < 3 ? '高速穩定、安全可靠，適合企業網站、電商及跨境業務。' : '一站式基礎服務，配合主機產品快速部署。'}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function HomePage({ products, navigate, siteSettings }) {
  const heroSlides = [
    {
      kicker: '香港 T3+ 數據中心',
      title: siteSettings.hero_title,
      text: siteSettings.hero_subtitle,
      image: '/assets/homepage-slide-1.png',
      stats: [
        { value: 'CN2 / BGP', label: '香港優化線路' },
        { value: '42', suffix: '+', label: '可售庫存' },
        { value: '99.9', suffix: '%', label: '網絡可用性' },
      ],
    },
    {
      kicker: 'CN2 / BGP 優化線路',
      title: '跨境業務穩定承載',
      text: '面向企業網站、電商平台和 SaaS 業務，提供低延遲接入、高防清洗和可追蹤交付。',
      image: '/assets/homepage-slide-2.png',
      stats: [
        { value: 'DDoS', label: '高防清洗' },
        { value: 'AES', label: '密碼加密' },
        { value: '7', suffix: 'x24', label: '安全監控' },
      ],
    },
    {
      kicker: '高防安全架構',
      title: '為核心業務抵禦流量攻擊',
      text: '高防清洗、伺服器密碼加密、到期任務與操作日志共同支撐可追蹤的運營交付。',
      image: '/assets/homepage-slide-3.png',
      stats: [
        { value: '10', suffix: 'min', label: '開通響應' },
        { value: '工單', label: '交付跟進' },
        { value: '日志', label: '操作可追蹤' },
      ],
    }
  ];

  const testimonials = [
    { name: '跨境電商團隊', text: '香港節點延遲穩定，晚高峰訪問也沒有明顯波動，工單回覆比之前的供應商快很多。', tag: '跨境電商', badges: ['CN2', 'HK'] },
    { name: 'SaaS 運維負責人', text: '後台能看到訂單、續費、到期和伺服器資料，人工開通模式也能保持清楚的交付記錄。', tag: 'SaaS', badges: ['OPS'] },
    { name: '內容平台站長', text: '高防方案上線後攻擊期間服務沒有中斷，續費通知和站內通知對日常運維很有幫助。', tag: '內容平台', badges: ['DDoS', 'CN2'] },
    { name: '遊戲社群運營', text: '活動高峰期登入和支付都很平穩，伺服器資料、續費和工單可以直接在同一個後台處理。', tag: '遊戲', badges: ['Peak', 'OPS'] },
    { name: '出海工具團隊', text: '採購、開通、續費和到期提醒一條鏈路走完，財務流水也能對上每一筆訂單。', tag: '出海', badges: ['Finance'] }
  ];

  return (
    <main className="stable-home-light">
      <HeroCarousel heroSlides={heroSlides} navigate={navigate} hk={hk} />
      <StatsStrip siteSettings={siteSettings} />
      <ProductShowcase products={products} navigate={navigate} />
      <InfrastructureSection navigate={navigate} />
      <TestimonialCarousel testimonials={testimonials} />
      <ServiceStrip />
    </main>
  );
}

export function ProductsPage({ products, navigate }) {
  return (
    <main>
      <section className="page-hero product-hero">
        <div className="container">
          <h1>產品中心</h1>
          <p>集中查看可售雲伺服器、高防及託管方案。這裏負責了解配置與價格，實際下單會進入伺服器購買頁。</p>
        </div>
      </section>
      <section className="products-listing">
        <div className="container">
          <div className="section-title">
            <span>Products</span>
            <h2>全部可售方案</h2>
          </div>
          <ProductGrid products={products} navigate={navigate} />
        </div>
      </section>
    </main>
  );
}

export function ProductGrid({ products, navigate }) {
  return (
    <div className="pricing-grid">
      {products.map((product) => (
        <article className="price-card" key={product.id}>
          <div className="price-image"><Server size={32} /></div>
          <span className="pill">{product.type}</span>
          <h3>{product.name}</h3>
          <p className="home-product-meta">{product.location} / {product.bandwidth}</p>
          <div className="price">起價 <strong>{formatMoney(product.priceMonthly)}</strong><span>/月</span></div>
          <ul>
            {[product.cpu, product.memory, product.disk, product.defense].map((item) => <li key={item}><Check size={16} />{item}</li>)}
          </ul>
          <button className="home-btn-primary wide" onClick={() => navigate(`/buy?product=${product.id}`)}>購買</button>
        </article>
      ))}
    </div>
  );
}
