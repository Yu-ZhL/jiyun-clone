import React, { useState } from 'react';
import { Mail, MessageCircle, Phone, QrCode, Send } from 'lucide-react';

function dollars(cents) {
  if (cents == null) return '-';
  return `$${(cents / 100).toFixed(0)}`;
}

function fmtRam(mbStr) {
  const mb = parseInt(mbStr || '0', 10);
  if (!mb) return '-';
  if (mb >= 1024) return `${Math.round(mb / 1024)}GB`;
  return `${mb}MB`;
}

function fmtDisk(diskStr, diskNum, diskSn) {
  if (!diskStr) return '-';
  // Strip "GB" suffix if already present (backend may store "1000GB")
  const gb = String(diskStr).replace(/GB$/i, '');
  const num = diskNum || 1;
  const sn = diskSn || '';
  return `${gb}GB * ${num}${sn}`;
}

function fmtCpu(cpuName, cpuCount) {
  const name = cpuName || '-';
  const count = cpuCount || 1;
  return `${name} * ${count}`;
}

function fmtBw(bandwidth) {
  if (!bandwidth) return '-';
  return bandwidth;
}

export function ServerProductTable({ groups, areas, products, onOpenContact }) {
  const [activeGroup, setActiveGroup] = useState(groups[0]?.id || '');
  const [activeArea, setActiveArea] = useState('');

  const groupAreas = areas.filter((a) => a.group === activeGroup);
  const effectiveArea = activeArea && groupAreas.some((a) => a.id === activeArea) ? activeArea : '';

  const filtered = products.filter((p) => {
    if (p.areaGroup !== activeGroup) return false;
    if (effectiveArea && p.areaKey !== effectiveArea) return false;
    return true;
  });

  const currentGroupName = groups.find((g) => g.id === activeGroup)?.name || '';
  const currentAreaName = areas.find((a) => a.id === effectiveArea)?.name || '';

  return (
    <div className="spt2-root">
      {/* Product group tabs — continuous horizontal */}
      <div className="spt2-group-tabs">
        {groups.map((g, i) => (
          <button
            key={g.id}
            className={`spt2-group-tab ${activeGroup === g.id ? 'active' : ''} ${i === 0 ? 'first' : ''} ${i === groups.length - 1 ? 'last' : ''}`}
            onClick={() => { setActiveGroup(g.id); setActiveArea(''); }}
          >
            {g.name}
          </button>
        ))}
      </div>

      {/* Description line */}
      <p className="spt2-desc">不同地域的实例之间内网互不相通；选择靠近您客户的地域，可降低网络时延、提高您客户的访问速度！</p>

      {/* Line tabs — second row */}
      {groupAreas.length > 0 && (
        <div className="spt2-area-tabs">
          {groupAreas.map((a) => (
            <button
              key={a.id}
              className={`spt2-area-tab ${effectiveArea === a.id ? 'active' : ''}`}
              onClick={() => setActiveArea(effectiveArea === a.id ? '' : a.id)}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Current selection */}
      {(currentGroupName || currentAreaName) && (
        <div className="spt2-current">
          <span className="spt2-badge">{currentGroupName}</span>
          {currentAreaName && <><span className="spt2-sep">&gt;</span><span className="spt2-badge accent">{currentAreaName}</span></>}
        </div>
      )}

      {/* Table — 6 columns, no "操作" */}
      <div className="spt2-table-wrap">
        <table className="spt2-table">
          <thead>
            <tr>
              <th>处理器</th>
              <th>内存</th>
              <th>硬盘</th>
              <th>带宽</th>
              <th>每月</th>
              <th>可用性</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="spt2-empty">暂无可用服务器</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id}>
                  <td className="spt2-cpu">{fmtCpu(p.cpu, p.cpuCount)}</td>
                  <td className="spt2-ram">{fmtRam(p.memory)}</td>
                  <td className="spt2-disk">{fmtDisk(p.disk, p.diskNum, p.diskSn)}</td>
                  <td className="spt2-bw">
                    <div>{fmtBw(p.bandwidth)}</div>
                    {p.netDesc && <div className="spt2-netdesc">({p.netDesc})</div>}
                  </td>
                  <td className="spt2-price"><strong>{dollars(p.priceMonthly)}</strong></td>
                  <td className="spt2-action">
                    <button className="spt2-btn-open" onClick={() => onOpenContact(p)}>开通</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function isEnabled(val) {
  return val === 'true' || val === true;
}

export function ContactModal({ product, siteSettings, user, onClose }) {
  const cfg = [
    { label: '产品组', value: product?.areaGroup || '-' },
    { label: '区域/线路', value: product?.netline || product?.area || '-' },
    { label: '处理器', value: fmtCpu(product?.cpu, product?.cpuCount) },
    { label: '内存', value: fmtRam(product?.memory) },
    { label: '硬盘', value: fmtDisk(product?.disk, product?.diskNum, product?.diskSn) },
    { label: '带宽', value: product?.bandwidth || '-' },
    { label: '月付价格', value: dollars(product?.priceMonthly) + '/月' }
  ];

  const contacts = [];
  if (isEnabled(siteSettings.sales_contact_phone_enabled) && siteSettings.sales_contact_phone) {
    contacts.push({ icon: <Phone size={18} />, label: '电话', value: siteSettings.sales_contact_phone, href: `tel:${siteSettings.sales_contact_phone.replace(/[^0-9+]/g, '')}` });
  }
  if (isEnabled(siteSettings.sales_contact_wechat_enabled) && siteSettings.sales_contact_wechat) {
    contacts.push({ icon: <MessageCircle size={18} />, label: '微信', value: siteSettings.sales_contact_wechat });
  }
  if (isEnabled(siteSettings.sales_contact_email_enabled) && siteSettings.support_email) {
    contacts.push({ icon: <Mail size={18} />, label: '邮箱', value: siteSettings.support_email, href: `mailto:${siteSettings.support_email}` });
  }
  if (isEnabled(siteSettings.sales_contact_telegram_enabled) && siteSettings.sales_contact_telegram) {
    contacts.push({
      icon: <Send size={18} />, label: 'Telegram', value: siteSettings.sales_contact_telegram,
      href: siteSettings.sales_contact_telegram_url || null
    });
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel contact-modal" role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{siteSettings.sales_contact_title || '联系客服开通'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">&times;</button>
        </div>

        <p className="contact-intro">{siteSettings.sales_contact_text || '请通过以下方式联系客服开通服务器。'}</p>

        {product && (
          <div className="contact-server-summary">
            <strong>所选服务器配置</strong>
            <div className="contact-cfg-grid">
              {cfg.map((item) => (
                <div key={item.label} className="contact-cfg-row">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="contact-user-hint">
          {user ? (
            <p>您已登录账号 <strong>{user.username}</strong>，联系客服时请告知您的账号，方便后台为您开通服务器。</p>
          ) : (
            <p>建议先<a href="/client?auth=register">注册</a>或<a href="/client">登录</a>后再联系客服，方便后台为您开通服务器并关联到您的账号。</p>
          )}
        </div>

        {isEnabled(siteSettings.sales_contact_qr_enabled) && siteSettings.sales_contact_qr_url && (
          <div className="contact-qr-wrap">
            <QrCode size={18} className="contact-qr-icon" />
            <img src={siteSettings.sales_contact_qr_url} alt="客服二维码" className="contact-qr-img" />
          </div>
        )}

        <div className="contact-info-list">
          {contacts.map((c) => (
            <div key={c.label} className="contact-info-item">
              <span className="contact-info-icon">{c.icon}</span>
              <span className="contact-info-label">{c.label}</span>
              {c.href ? (
                <a href={c.href} target="_blank" rel="noopener noreferrer" className="contact-info-link">{c.value}</a>
              ) : (
                <strong>{c.value}</strong>
              )}
            </div>
          ))}
        </div>

        <button className="primary wide" onClick={onClose} style={{ marginTop: 18 }}>我知道了</button>
      </section>
    </div>
  );
}
