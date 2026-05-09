import React, { useState } from 'react';
import {
  ChevronLeft,
  MessageSquare,
  X
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

export function ServerCards({ servers, highlightedServerId, renew }) {
  if (!servers.length) return <p className="muted">暂无服务器</p>;
  return (
    <div className="server-card-grid">
      {servers.map((server) => {
        const relatedOrders = [server.order, ...(server.orders || [])].filter(Boolean);
        const latestMessage = server.order?.notifications?.[0];
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
              <span>IP 地址</span><strong>{server.ip}</strong>
              <span>系统</span><strong>{server.os || '-'}</strong>
              <span>登录信息</span><strong>{server.loginUser} / {server.loginPassword}</strong>
              <span>到期时间</span><strong>{formatDate(server.expiresAt)}</strong>
              <span>关联订单</span><strong>{relatedOrders.map((order) => order.orderNo).join(' / ') || '-'}</strong>
            </div>
            {latestMessage && <div className="message-preview server-message"><MessageSquare size={14} /><span>{latestMessage.content}</span></div>}
            <div className="server-card-actions">
              <button className="table-action" onClick={() => renew(server.id)}>续费</button>
            </div>
          </article>
        );
      })}
    </div>
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
          <span>关联服务器</span><strong>{server ? `${server.name || '-'} / ${server.ip || '-'}` : '-'}</strong>
        </div>
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
          <select className="dt-page-size" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {pageSizeOptions.map((n) => <option key={n} value={n}>{n} 条/页</option>)}
          </select>
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
