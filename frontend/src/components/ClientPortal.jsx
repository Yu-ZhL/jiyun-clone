import React, { useEffect, useState } from 'react';
import {
  Bell, Cloud, CreditCard, LayoutDashboard, LogIn, Plus,
  ReceiptText, Server, Ticket
} from 'lucide-react';
import {
  hk, api, formatMoney, formatDate, getClientSection,
  orderTypeLabels, payStatusLabels, provisionStatusLabels, ticketStatusLabels
} from '../utils';
import {
  ActionGroup, DataTable, Metric, Modal, OrderDetailModal, OrderNumberCell,
  OrderProductCell, NotificationTitle, Panel, Rows, ServerCards, ServerDetailModal,
  StatusPill, ClientTicketDetail
} from './SharedUI';

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
  const section = getClientSection(route);
  const [data, setData] = useState({ summary: null, orders: [], servers: [], wallet: [], tickets: [], notifications: [] });
  const [ticket, setTicket] = useState({ title: '', content: '' });
  const [orderDetail, setOrderDetail] = useState(null);
  const [highlightedServerId, setHighlightedServerId] = useState('');
  const [serverDetail, setServerDetail] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
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
  useEffect(() => { load().catch((error) => setNotice(error.message)); }, [section]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load().catch(() => { });
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (section !== 'notifications') return;
    const unread = data.notifications.filter((item) => !item.readAt);
    if (!unread.length) return;
    Promise.all(unread.map((item) => api(`/api/client/notifications/${item.id}/read`, { method: 'POST' })))
      .then(load)
      .catch((error) => setNotice(error.message));
  }, [section, data.notifications.length]);

  const getOrderServer = (order) => order.openedServer || order.server || data.servers.find((server) => server.orderId === order.id || server.order?.id === order.id);

  const showOrderServer = (order) => {
    const server = getOrderServer(order);
    if (!server) {
      setNotice('这个订单还没有关联服务器');
      return;
    }
    setHighlightedServerId(server.id);
    navigate('/client/servers');
    setNotice(`已定位服务器：${server.name || server.ip}`);
  };

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

  const markNotificationRead = async (notificationId) => {
    try {
      await api(`/api/client/notifications/${notificationId}/read`, { method: 'POST' });
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

  const submitTicketReply = async (ticketId, content) => {
    try {
      await api(`/api/client/tickets/${ticketId}/replies`, { method: 'POST', body: { content } });
      setNotice('回复已发送');
      await load();
      const updated = (await api('/api/client/tickets')).find((t) => t.id === ticketId);
      if (updated) setSelectedTicket(updated);
    } catch (error) {
      setNotice(error.message);
    }
  };

  const closeClientTicket = async (ticketId) => {
    try {
      await api(`/api/client/tickets/${ticketId}/close`, { method: 'POST' });
      setNotice('工单已关闭');
      await load();
      setSelectedTicket(null);
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
        {clientMenu.map(([key, Icon, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => navigate(key === 'overview' ? '/client' : `/client/${key}`)}><Icon size={18} />{label}</button>)}
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
        {section === 'servers' && <Panel title="我的服务器"><ServerCards servers={data.servers} highlightedServerId={highlightedServerId} renew={renew} onViewDetail={setServerDetail} /></Panel>}
        {section === 'orders' && <Panel title="订单记录"><DataTable columns={['订单', '产品与消息', '类型', '金额', '支付状态', '开通状态', '操作']} rows={data.orders.map((order) => [
          <OrderNumberCell order={order} />,
          <OrderProductCell order={order} />,
          orderTypeLabels[order.type] || order.type,
          formatMoney(order.amount),
          <StatusPill value={order.payStatus} labels={payStatusLabels} />,
          <StatusPill value={order.provisionStatus} labels={provisionStatusLabels} />,
          <ActionGroup actions={[
            ['查看详情', () => setOrderDetail(order)],
            ...(order.payStatus === 'unpaid' ? [['余额支付', () => pay(order.id)]] : []),
            ...(order.provisionStatus === 'opened' && getOrderServer(order) ? [['我的服务器', () => showOrderServer(order)]] : [])
          ]} />
        ])} /></Panel>}
        {section === 'tickets' && (selectedTicket ? (
          <ClientTicketDetail ticket={selectedTicket} onBack={() => setSelectedTicket(null)} onReply={(content) => submitTicketReply(selectedTicket.id, content)} onClose={() => closeClientTicket(selectedTicket.id)} />
        ) : (
          <div className="two-col">
            <Panel title="提交工单"><form className="admin-form ticket-form" onSubmit={submitTicket}><input placeholder="标题" value={ticket.title} onChange={(event) => setTicket((prev) => ({ ...prev, title: event.target.value }))} required /><input placeholder="内容" value={ticket.content} onChange={(event) => setTicket((prev) => ({ ...prev, content: event.target.value }))} required /><button className="primary" type="submit">提交</button></form></Panel>
            <Panel title="工单列表">
              {data.tickets.length ? data.tickets.map((item) => (
                <div className="ticket-list-item" key={item.id} onClick={() => setSelectedTicket(item)}>
                  <strong>{item.title}</strong>
                  <StatusPill value={item.status} labels={ticketStatusLabels} />
                  <em>{formatDate(item.updatedAt)}</em>
                </div>
              )) : <p className="muted">暂无工单</p>}
            </Panel>
          </div>
        ))}
        {section === 'wallet' && <Panel title="余额流水"><Rows rows={data.wallet.map((item) => ({ left: item.remark || item.type, mid: formatMoney(item.amount), right: formatMoney(item.balanceAfter) }))} /></Panel>}
        {section === 'notifications' && <Panel title="站内通知"><DataTable columns={['通知', '关联订单', '内容', '时间', '状态', '操作']} rows={data.notifications.map((item) => [
          <NotificationTitle item={item} />,
          item.order?.orderNo || '-',
          <div className="message-preview notification-content"><span>{item.content}</span></div>,
          formatDate(item.createdAt),
          item.readAt ? '已读' : '未读',
          item.readAt ? '-' : <button className="table-action" onClick={() => markNotificationRead(item.id)}>标记已读</button>
        ])} /></Panel>}
        {orderDetail && <OrderDetailModal order={orderDetail} server={getOrderServer(orderDetail)} onClose={() => setOrderDetail(null)} showServer={() => showOrderServer(orderDetail)} pay={pay} />}
        {serverDetail && <ServerDetailModal server={serverDetail} onClose={() => setServerDetail(null)} />}
      </section>
    </main>
  );
}

export { ClientPortal, AuthPage, ClientDashboard };
