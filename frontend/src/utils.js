export const hk = {
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

export const defaultSiteSettings = {
  site_name: '極雲主機管理系統',
  support_phone: '800-800-8000',
  support_email: 'support@example.com',
  copyright: 'Copyright © 極雲主機管理系統',
  hero_title: hk.heroTitle,
  hero_subtitle: hk.heroSub,
  sales_contact_title: '联系客服开通服务器',
  sales_contact_text: '请通过以下方式联系客服，我们将为您开通所需服务器配置。',
  sales_contact_phone: '+852 800-888-888',
  sales_contact_wechat: 'jiyun_support',
  sales_contact_qr_url: ''
};

export function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.textContent || div.innerText || '';
}

export function formatRam(mb) {
  if (mb >= 1024) return `${Math.round(mb / 1024)}GB`;
  return `${mb}MB`;
}

export function formatBandwidth(value) {
  if (!value) return '-';
  const str = String(value);
  if (/^\d+$/.test(str)) return `${str}M`;
  return str;
}

export const emptyProductForm = {
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

export async function api(path, options = {}) {
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

export function formatMoney(cents) {
  return `$${(Number(cents || 0) / 100).toLocaleString('zh-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function moneyInput(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

export function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-HK', { hour12: false });
}

export function dateInput(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

export const orderTypeLabels = {
  new_server: '新购服务器',
  renew_server: '续费订单'
};

export const payStatusLabels = {
  unpaid: '待支付',
  paid: '已支付',
  cancelled: '已取消',
  refunded: '已退款'
};

export const provisionStatusLabels = {
  none: '无需开通',
  pending: '待开通',
  opened: '已开通'
};

export const ticketStatusLabels = {
  open: '待处理',
  replied: '已回复',
  closed: '已关闭'
};

export const userStatusLabels = {
  active: '正常',
  disabled: '已禁用'
};

export const productStatusLabels = {
  on_sale: '上架中',
  off_sale: '已下架'
};

export const serverStatusLabels = {
  pending: '待开通',
  running: '运行中',
  suspended: '已暂停',
  expired: '已到期',
  expiring: '即将到期',
  deleted: '已删除'
};

export function textIncludes(value, keyword) {
  return String(value || '').toLowerCase().includes(keyword.toLowerCase());
}

export function getRoute() {
  return window.location.pathname + (window.location.search || '');
}

export function getClientSection(route) {
  const path = route.split('?')[0];
  const match = path.match(/^\/client\/(\w+)/);
  if (match) return match[1];
  const query = new URLSearchParams(route.split('?')[1] || '');
  if (query.has('tickets')) return 'tickets';
  return query.get('section') || 'overview';
}

export function getAdminSection(route) {
  const path = route.split('?')[0];
  const match = path.match(/^\/admin\/(\w+)/);
  return match ? match[1] : 'dashboard';
}
