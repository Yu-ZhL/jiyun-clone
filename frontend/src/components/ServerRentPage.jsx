import React, { useEffect, useState } from 'react';
import { ServerProductTable, ContactModal } from './ServerProductTable';

export function ServerRentPage({ navigate, api, siteSettings, user }) {
  const [data, setData] = useState({ groups: [], areas: [], products: [], needsSync: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contactProduct, setContactProduct] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api('/api/server-products');
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <main className="server-rent-page-v2">
      {/* Head with image */}
      <div className="srv-head">
        <div className="srv-head-inner">
          <div className="srv-head-copy">
            <h1>服务器租用</h1>
            <p>按需购买、按量付费的物理服务器租赁服务，为核心数据库、关键应用系统、高性能计算业务提供云端专用的高性能、安全隔离的物理集群。</p>
            <div className="srv-head-stats">
              <div><strong>{data.products.length}</strong><span>可售库存</span></div>
              <div><strong>{data.groups.length}</strong><span>产品组</span></div>
              <div><strong>{data.areas.length}</strong><span>线路</span></div>
            </div>
          </div>
          <div className="srv-head-img">
            <img src="/assets/homepage-platform-infra.png" alt="数据中心基础设施" />
          </div>
        </div>
      </div>

      <div className="srv-content">
        {loading && <div className="loading-wrap"><span className="spinner" /> 加载中...</div>}
        {error && <div className="error-message">请求失败：{error}</div>}

        {data.needsSync && !loading && (
          <div className="srv-needs-sync">
            <p>上游目录正在初始化，请稍后刷新页面。</p>
            <button className="primary" onClick={fetchData}>刷新</button>
          </div>
        )}

        {!loading && !error && !data.needsSync && (
          <ServerProductTable
            groups={data.groups}
            areas={data.areas}
            products={data.products}
            onOpenContact={setContactProduct}
          />
        )}
      </div>

      {contactProduct && (
        <ContactModal
          product={contactProduct}
          siteSettings={siteSettings}
          user={user}
          onClose={() => setContactProduct(null)}
        />
      )}
    </main>
  );
}
