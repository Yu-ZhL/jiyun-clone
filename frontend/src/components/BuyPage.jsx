import React, { useEffect, useState } from 'react';
import { Search, Server, ShoppingCart } from 'lucide-react';
import { hk, api, formatMoney } from '../utils';

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
      navigate('/client/orders');
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

export { BuyPage };
