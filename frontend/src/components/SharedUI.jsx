import React, { useState } from 'react';
import {
  Check, ChevronDown, ChevronLeft, Copy, Eye,
  MessageSquare, X
} from 'lucide-react';
import { formatDate, formatMoney, orderTypeLabels, payStatusLabels, provisionStatusLabels, serverStatusLabels, ticketStatusLabels } from '../utils';

export function UserIdentity({ user, compact = false }) {
  if (!user) return '-';
  return (
    <div className={`identity-cell ${compact ? 'compact' : ''}`}>
      <span className="identity-avatar">{user.username?.slice(0, 1).toUpperCase() || 'U'}</span>
      <span><strong>{user.username}</strong><small>ID {user.id?.slice(-6) || '-'}</small></span>
    </div>
  );
}

function CompactSelect({ value, onChange, options, ariaLabel = '选择' }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => String(option.value) === String(value)) || options[0];
  return (
    <div className="admin-select-control dt-page-size-control" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button type="button" className="admin-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((next) => !next)}>
        <span>{selected?.label || '-'}</span>
        <ChevronDown size={15} />
      </button>
      {open && (
        <div className="admin-select-menu" role="listbox" tabIndex={-1}>
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`admin-select-option ${String(option.value) === String(value) ? 'selected' : ''}`}
              role="option"
              aria-selected={String(option.value) === String(value)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {String(option.value) === String(value) && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function UserBusinessStats({ user }) {
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

export function OrderNumberCell({ order }) {
  return (
    <div className="meta-stack order-number-cell">
      <strong>{order.orderNo}</strong>
      <small>{formatDate(order.createdAt)}</small>
    </div>
  );
}

export function OrderProductCell({ order }) {
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

export function NotificationTitle({ item }) {
  return (
    <div className="meta-stack">
      <strong>{item.title}</strong>
      <small>{item.type === 'order_message' ? '订单消息' : item.type === 'server_opened' ? '开通通知' : item.type === 'ticket_reply' ? '工单回复' : item.type}</small>
    </div>
  );
}

export function ServerCards({ servers, highlightedServerId, renew, onViewDetail }) {
  if (!servers.length) return <p className="muted">暂无服务器</p>;
  return (
    <div className="server-card-grid">
      {servers.map((server) => {
        const relatedOrders = [server.order, ...(server.orders || [])].filter(Boolean);
        const latestMessage = server.order?.notifications?.[0];
        const location = [server.region, server.networkLine].filter(Boolean).join(' / ');
        const specs = [server.bandwidth, server.defense].filter(Boolean).join(' / ');
        return (
          <article className={`server-card ${highlightedServerId === server.id ? 'highlight' : ''}`} key={server.id}>
            <div className="server-card-head">
              <div>
                <strong>{server.name}</strong>
                <span>{server.product?.name || '-'}</span>
              </div>
              <StatusPill value={server.status} labels={serverStatusLabels} />
            </div>
            <div className="server-kv">
              <span>主 IP</span><strong><span className="copyable" title="点击复制" onClick={() => navigator.clipboard.writeText(server.ip)}>{server.ip}</span></strong>
              {server.ipv6 && <><span>IPv6</span><strong>{server.ipv6}</strong></>}
              {location && <><span>地区/线路</span><strong>{location}</strong></>}
              <span>系统</span><strong>{server.os || '-'}</strong>
              <span>SSH</span><strong>{server.loginUser} / {server.loginPassword} {server.sshPort && server.sshPort !== 22 ? `:${server.sshPort}` : ''}</strong>
              {specs && <><span>带宽/防御</span><strong>{specs}</strong></>}
              <span>到期时间</span><strong>{formatDate(server.expiresAt)}</strong>
              <span>关联订单</span><strong>{relatedOrders.map((order) => order.orderNo).join(' / ') || '-'}</strong>
            </div>
            {latestMessage && <div className="message-preview server-message"><MessageSquare size={14} /><span>{latestMessage.content}</span></div>}
            <div className="server-card-actions">
              {onViewDetail && <button className="table-action" onClick={() => onViewDetail(server)}><Eye size={15} />查看详情</button>}
              <button className="table-action" onClick={() => renew(server.id)}>续费</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function ServerDetailModal({ server, onClose }) {
  const [copied, setCopied] = useState('');
  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 2000); } catch { /* ignore */ }
  };
  const CopyBtn = ({ text, label }) => (
    <button className="copy-btn" title={`复制${label}`} onClick={() => copy(text, label)}>
      {copied === label ? <><Check size={13} />已复制</> : <><Copy size={13} />复制</>}
    </button>
  );
  const Kv = ({ label, value, copyable }) => (
    <div className="sdetail-kv">
      <span>{label}</span>
      <div className="sdetail-value">
        <strong>{value || '-'}</strong>
        {copyable && value && <CopyBtn text={value} label={label} />}
      </div>
    </div>
  );

  return (
    <Modal title={`服务器详情：${server.name}`} onClose={onClose}>
      <div className="server-detail">
        <div className="sdetail-section">
          <h3>基础信息</h3>
          <Kv label="服务器名称" value={server.name} />
          <Kv label="产品" value={server.product?.name} />
          <Kv label="状态" value={serverStatusLabels[server.status] || server.status} />
          <Kv label="主 IP" value={server.ip} copyable />
          <Kv label="IPv6" value={server.ipv6} copyable />
          <Kv label="附加 IP" value={server.extraIps} />
          <Kv label="系统" value={server.os} />
        </div>

        <div className="sdetail-section">
          <h3>登录信息</h3>
          <Kv label="SSH 用户" value={server.loginUser} />
          <Kv label="SSH 密码" value={server.loginPassword} copyable />
          <Kv label="SSH 端口" value={String(server.sshPort ?? 22)} />
        </div>

        {server.panelUrl && (
          <div className="sdetail-section">
            <h3>控制面板</h3>
            <Kv label="面板地址" value={server.panelUrl} copyable />
            <Kv label="面板账号" value={server.panelUser} />
            <Kv label="面板密码" value={server.panelPassword} copyable />
          </div>
        )}

        <div className="sdetail-section">
          <h3>网络资源</h3>
          <Kv label="地区" value={server.region} />
          <Kv label="线路" value={server.networkLine} />
          <Kv label="带宽" value={server.bandwidth} />
          <Kv label="防御" value={server.defense} />
          <Kv label="DNS / Nameserver" value={server.nameservers} />
        </div>

        {server.deliveryNote && (
          <div className="sdetail-section">
            <h3>开通说明</h3>
            <p className="sdetail-note">{server.deliveryNote}</p>
          </div>
        )}

        <div className="sdetail-section">
          <h3>时间</h3>
          <Kv label="开通时间" value={formatDate(server.openedAt)} />
          <Kv label="到期时间" value={formatDate(server.expiresAt)} />
        </div>

        <div className="sdetail-section">
          <h3>关联订单</h3>
          <Kv label="订单号" value={server.order?.orderNo || server.orderId || '-'} />
        </div>
      </div>
    </Modal>
  );
}

export function OrderDetailModal({ order, server, onClose, showServer, pay }) {
  const messages = order.notifications || [];
  return (
    <Modal title={`订单详情：${order.orderNo}`} onClose={onClose}>
      <div className="order-detail">
        <div className="detail-grid">
          <span>产品</span><strong>{order.product?.name || '-'}</strong>
          <span>订单类型</span><strong>{orderTypeLabels[order.type] || order.type}</strong>
          <span>金额</span><strong>{formatMoney(order.amount)}</strong>
          <span>周期</span><strong>{order.cycle === 'yearly' ? '年付' : order.cycle === 'monthly' ? '月付' : '-'}</strong>
          <span>支付状态</span><StatusPill value={order.payStatus} labels={payStatusLabels} />
          <span>开通状态</span><StatusPill value={order.provisionStatus} labels={provisionStatusLabels} />
          <span>创建时间</span><strong>{formatDate(order.createdAt)}</strong>
          <span>支付时间</span><strong>{formatDate(order.paidAt)}</strong>
          <span>关联服务器</span><strong>{server ? `${server.name || '-'} / ${server.ip || '-'}` : (order.provisionStatus === 'opened' ? '已开通（请在"我的服务器"查看）' : '-')}</strong>
        </div>
        {server && order.provisionStatus === 'opened' && (
          <div className="detail-section">
            <h3>服务器交付摘要</h3>
            <div className="detail-grid">
              <span>名称</span><strong>{server.name || '-'}</strong>
              <span>IP</span><strong>{server.ip || '-'}</strong>
              <span>系统</span><strong>{server.os || '-'}</strong>
              <span>到期</span><strong>{formatDate(server.expiresAt)}</strong>
              {server.panelUrl && <><span>面板</span><strong>{server.panelUrl}</strong></>}
            </div>
          </div>
        )}
        <div className="detail-section">
          <h3>订单消息</h3>
          {messages.length ? messages.map((message) => (
            <div className="message-preview detail-message" key={message.id}>
              <MessageSquare size={14} />
              <span>{message.content}</span>
              <em>{formatDate(message.createdAt)}</em>
            </div>
          )) : <p className="muted">暂无订单消息</p>}
        </div>
        <div className="modal-actions">
          {order.payStatus === 'unpaid' && <button className="primary" onClick={() => pay(order.id)}>余额支付</button>}
          {server && <button className="primary" onClick={() => { onClose(); showServer(); }}>查看我的服务器</button>}
        </div>
      </div>
    </Modal>
  );
}

export function TicketTitleCell({ ticket }) {
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

export function TicketLastReply({ ticket }) {
  const reply = latestReply(ticket);
  if (!reply) return '-';
  return (
    <div className="message-preview ticket-preview">
      <span>{reply.content}</span>
      <em>{reply.senderType === 'admin' ? '后台' : '用户'} · {formatDate(reply.createdAt)}</em>
    </div>
  );
}

export function ClientTicketDetail({ ticket, onBack, onReply, onClose }) {
  const [replyContent, setReplyContent] = useState('');
  const replies = ticket.replies || [];

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    await onReply(replyContent.trim());
    setReplyContent('');
  };

  return (
    <div className="ticket-detail-view">
      <button className="table-action" onClick={onBack}><ChevronLeft size={16} />返回工单列表</button>
      <div className="ticket-detail-head">
        <h2>{ticket.title}</h2>
        <StatusPill value={ticket.status} labels={ticketStatusLabels} />
        <div className="ticket-detail-meta">
          <span>分类：{ticket.category || 'support'}</span>
          <span>创建时间：{formatDate(ticket.createdAt)}</span>
          {ticket.closedAt && <span>关闭时间：{formatDate(ticket.closedAt)}</span>}
        </div>
      </div>
      <div className="ticket-reply-thread">
        {replies.map((reply) => (
          <article className={`ticket-reply-card ${reply.senderType}`} key={reply.id}>
            <div className="ticket-reply-head">
              <strong>{reply.senderType === 'admin' ? '客服回复' : '我的回复'}</strong>
              <em>{formatDate(reply.createdAt)}</em>
            </div>
            <div className="reply-body">{reply.content}</div>
          </article>
        ))}
        {!replies.length && <p className="muted">暂无回复</p>}
      </div>
      {ticket.status !== 'closed' && (
        <form className="ticket-reply-form" onSubmit={handleReply}>
          <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="输入回复内容..." required />
          <button className="primary" type="submit">发送回复</button>
          <button className="secondary" type="button" onClick={onClose}>关闭工单</button>
        </form>
      )}
    </div>
  );
}

export function ActionGroup({ actions }) {
  const activeActions = actions.filter(Boolean);
  if (!activeActions.length) return '-';
  return <div className="action-group">{activeActions.map(([label, onClick]) => <button className="table-action" key={label} onClick={onClick}>{label}</button>)}</div>;
}

export function StatusPill({ value, labels }) {
  return <span className={`status-pill ${value || 'unknown'}`}>{labels[value] || value || '-'}</span>;
}

export function Metric({ icon, label, value }) {
  return <article className="metric-card"><div>{icon}</div><span>{label}</span><strong>{value}</strong></article>;
}

export function Panel({ title, children }) {
  return <section className="panel"><div className="panel-title"><h2>{title}</h2></div>{children}</section>;
}

export function DataTable({ columns, rows, pagination, pageSize: pageSizeProp, defaultPageSize = 20, pageSizeOptions = [10, 20, 50, 100] }) {
  const ps = pageSizeProp || defaultPageSize;
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(ps);

  React.useEffect(() => { setPage(1); }, [rows.length]);

  if (!pagination || rows.length <= pageSize) {
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

  const totalPages = Math.ceil(rows.length / pageSize);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = rows.slice(start, start + pageSize);

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= safePage - 2 && i <= safePage + 2)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <section className="panel">
      <div className="responsive-table">
        <table>
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>{paged.map((row, index) => <tr key={start + index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <div className="dt-pagination">
        <span className="dt-page-info">第 {start + 1}-{Math.min(start + pageSize, rows.length)} 条 / 共 {rows.length} 条</span>
        <div className="dt-page-controls">
          <CompactSelect value={pageSize} ariaLabel="每页条数" options={pageSizeOptions.map((n) => ({ value: n, label: `${n} 条/页` }))} onChange={(value) => { setPageSize(Number(value)); setPage(1); }} />
          <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>上一页</button>
          {pages.map((p, i) => (
            p === '...' ? <span key={`dot-${i}`} className="dt-page-dot">...</span> :
            <button key={p} className={p === safePage ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
          ))}
          <button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>下一页</button>
        </div>
      </div>
    </section>
  );
}

export function Rows({ rows }) {
  if (!rows.length) return <p className="muted">暂无数据</p>;
  return rows.map((row, index) => <div className="list-item" key={index}><span>{row.left}</span><strong>{row.mid}</strong><em>{row.right}</em>{row.action}</div>);
}

export function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="关闭"><X size={18} /></button></div>
        {children}
      </section>
    </div>
  );
}
