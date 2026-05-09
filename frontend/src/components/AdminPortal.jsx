import React, { useEffect, useState } from 'react';
import {
  Bell, Boxes, CircleDollarSign, Cloud, LayoutDashboard,
  MessageSquare, PackagePlus, Plus, ReceiptText, RefreshCw, Search,
  Server, Settings, Ticket, User, Users
} from 'lucide-react';
import { api, emptyProductForm, formatDate, formatMoney, moneyInput, dateInput,
  getAdminSection, textIncludes, orderTypeLabels, payStatusLabels,
  provisionStatusLabels, ticketStatusLabels, productStatusLabels,
  serverStatusLabels, userStatusLabels } from '../utils';
import {
  ActionGroup, DataTable, Metric, Modal, OrderNumberCell, OrderProductCell,
  Panel, Rows, StatusPill, TicketLastReply, TicketTitleCell, UserBusinessStats, UserIdentity
} from './SharedUI';

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

function AdminDashboard({ admin, navigate, refreshAdmin, setNotice, refreshProducts, refreshSiteSettings, route }) {
  const section = getAdminSection(route);
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
  const [upstreamSummary, setUpstreamSummary] = useState({ products: 0, newCount: 0, changedCount: 0, offlineCount: 0 });
  const [syncing, setSyncing] = useState(false);

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

  useEffect(() => { load().catch((error) => setNotice(error.message)); loadUpstreamSummary(); }, []);

  const loadUpstreamSummary = async () => {
    try {
      const [products, diff] = await Promise.all([
        api('/api/admin/upstream/fastmos/products'),
        api('/api/admin/upstream/fastmos/diff')
      ]);
      setUpstreamSummary({
        products: products.length,
        newCount: diff.new?.length || 0,
        changedCount: diff.changed?.length || 0,
        offlineCount: diff.offline?.length || 0
      });
    } catch (_) { /* non-critical */ }
  };

  const syncUpstream = async () => {
    setSyncing(true);
    try {
      const result = await api('/api/admin/upstream/fastmos/sync', { method: 'POST' });
      setNotice(`同步完成：${result.fetched} 台，新增 ${result.new}，变更 ${result.changed}，下架 ${result.offline}`);
      await Promise.all([loadUpstreamSummary(), load()]);
    } catch (e) { setNotice(e.message); }
    finally { setSyncing(false); }
  };

  const cleanupTestProducts = async () => {
    try {
      const result = await api('/api/admin/products/cleanup-test', { method: 'POST' });
      setNotice(result.message);
      await load();
    } catch (e) { setNotice(e.message); }
  };
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
    const logs = result.logs?.deleted || 0;
    const parts = [];
    if (notices > 0) parts.push(`到期提醒 ${notices} 条`);
    if (expired > 0) parts.push(`过期处理 ${expired} 台`);
    if (suspended > 0) parts.push(`暂停 ${suspended} 台`);
    if (cancelled > 0) parts.push(`取消订单 ${cancelled} 个`);
    if (tokens > 0) parts.push(`清理令牌 ${tokens} 个`);
    if (logs > 0) parts.push(`清理日志 ${logs} 条`);
    if (parts.length === 0) parts.push('无需处理');
    return `定时任务已完成：${parts.join('，')}。`;
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
    navigate('/admin/servers');
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
          ['upstream', RefreshCw, '上游产品'],
          ['logs', Settings, '操作日志']
        ].map(([key, Icon, label]) => <button key={key} className={section === key ? 'active' : ''} onClick={() => navigate(key === 'dashboard' ? '/admin' : `/admin/${key}`)}><Icon size={18} />{label}</button>)}
      </aside>
      <section className="admin-main">
        <div className="admin-top">
          <label className="admin-search" htmlFor="admin-global-search"><Search size={17} /><input id="admin-global-search" name="adminSearch" value={adminFilter} onChange={(event) => setAdminFilter(event.target.value)} placeholder="搜索订单号 / 用户 / 产品 / IP / 工单" /></label>
          <button className="icon-btn" onClick={() => navigate('/admin/tickets')} title="查看待处理工单"><Bell size={18} /></button>
          <div className="admin-user-menu">
            <button className="admin-user" onClick={() => setAdminMenuOpen((value) => !value)}><User size={17} />{admin.username}</button>
            {adminMenuOpen && (
              <div className="admin-dropdown">
                <strong>{admin.name || admin.username}</strong>
                <span>{admin.role || 'administrator'}</span>
                <button onClick={() => { navigate('/admin/logs'); setAdminMenuOpen(false); }}>系统设置</button>
                <button onClick={() => { navigate('/admin/tickets'); setAdminMenuOpen(false); }}>工单处理</button>
                <button onClick={() => { setPasswordForm({ open: true, currentPassword: '', newPassword: '', confirmPassword: '' }); setAdminMenuOpen(false); }}>修改密码</button>
                <button onClick={logout}>退出登录</button>
              </div>
            )}
          </div>
        </div>
        {section === 'dashboard' && <AdminSummary summary={data.summary} runJobs={runJobs} />}
        {section === 'products' && <AdminProducts products={data.products} keyword={adminFilter} form={productForm} setForm={setProductForm} addProduct={addProduct} updateProductStatus={updateProductStatus} openProductEdit={openProductEdit} upstreamSummary={upstreamSummary} syncUpstream={syncUpstream} cleanupTestProducts={cleanupTestProducts} syncing={syncing} navigate={navigate} />}
        {section === 'orders' && <AdminOrders orders={data.orders} keyword={adminFilter} markPaid={markPaid} orderAction={orderAction} openOrderMessage={(order) => setOrderMessageForm({ open: true, order, content: '' })} openProvision={openProvisionFromOrder} />}
        {section === 'servers' && <AdminServers servers={data.servers} keyword={adminFilter} orders={pendingPaidOrders} form={serverForm} setForm={setServerForm} openServer={openServer} openServerEdit={openServerEdit} serverAction={serverAction} />}
        {section === 'users' && <AdminUsers users={data.users} keyword={adminFilter} openUserEdit={openUserEdit} openRecharge={(user) => setRechargeForm({ open: true, user, amount: '', remark: '后台手动充值' })} setUserStatus={setUserStatus} impersonate={impersonate} />}
        {section === 'tickets' && <AdminTickets tickets={data.tickets} keyword={adminFilter} openReply={(ticket) => setReplyForm({ open: true, ticket, content: '' })} closeTicket={closeTicket} />}
        {section === 'upstream' && <AdminUpstream api={api} setNotice={setNotice} load={load} />}
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
          <div className="ticket-conversation-modal">
            <Modal title={`工单：${replyForm.ticket.title}`} onClose={() => setReplyForm({ open: false, ticket: null, content: '' })}>
              <div className="ticket-conversation-body">
                <div className="ticket-detail-meta">
                  <span>用户：{replyForm.ticket.user?.username || '-'}</span>
                  <span>分类：{replyForm.ticket.category || 'support'}</span>
                  <span>状态：{ticketStatusLabels[replyForm.ticket.status] || replyForm.ticket.status}</span>
                  <span>创建：{formatDate(replyForm.ticket.createdAt)}</span>
                  {replyForm.ticket.closedAt && <span>关闭：{formatDate(replyForm.ticket.closedAt)}</span>}
                </div>
                {(replyForm.ticket.replies || []).map((reply) => (
                  <article className={`ticket-reply-card ${reply.senderType}`} key={reply.id}>
                    <div className="ticket-reply-head">
                      <strong>{reply.senderType === 'admin' ? '后台回复' : '用户'}</strong>
                      <em>{formatDate(reply.createdAt)}</em>
                    </div>
                    <div className="reply-body">{reply.content}</div>
                  </article>
                ))}
                {(!replyForm.ticket.replies || !replyForm.ticket.replies.length) && <p className="muted">暂无回复记录</p>}
              </div>
              {replyForm.ticket.status !== 'closed' && (
                <form className="modal-form" onSubmit={submitReply} style={{ marginTop: 18 }}>
                  <label>回复内容<textarea value={replyForm.content} onChange={(event) => setReplyForm((prev) => ({ ...prev, content: event.target.value }))} required /></label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="primary" type="submit">发送回复</button>
                    <button className="secondary" type="button" onClick={() => { closeTicket(replyForm.ticket); setReplyForm({ open: false, ticket: null, content: '' }); }}>关闭工单</button>
                  </div>
                </form>
              )}
            </Modal>
          </div>
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

function AdminProducts({ products, keyword, form, setForm, addProduct, updateProductStatus, openProductEdit, upstreamSummary, syncUpstream, cleanupTestProducts, syncing, navigate }) {
  const rows = products.filter((product) => [product.name, product.type, product.location, product.cpu, product.memory, product.disk, product.bandwidth, product.status].some((value) => textIncludes(value, keyword)));
  return (
    <div className="admin-page">
      <h1>产品管理</h1>

      {/* Upstream sync operation area */}
      <Panel title="上游服务器同步">
        <div className="dashboard-actions" style={{ marginBottom: 16 }}>
          <button className="primary" onClick={syncUpstream} disabled={syncing}>
            <RefreshCw size={17} />{syncing ? '同步中...' : '同步上游服务器'}
          </button>
          <button className="secondary" onClick={() => navigate('/admin/upstream')}>查看差异/合并</button>
          <button className="secondary" onClick={cleanupTestProducts}>清理测试产品</button>
          <button className="secondary" onClick={async () => {
            try {
              const r = await api('/api/admin/maintenance/cleanup-test-business-data', { method: 'POST', body: { dryRun: true } });
              const c = r.counts;
              setNotice(`预览：Renewal ${c.Renewal}，Server ${c.Server}，Order ${c.Order}，Wallet ${c.WalletTransaction}，Notif ${c.Notification}，TicketReply ${c.TicketReply}，Ticket ${c.Ticket}，Token ${c.ImpersonationToken}`);
            } catch (e) { setNotice(e.message); }
          }}>预览清理业务数据</button>
          <button className="secondary" onClick={async () => {
            if (!window.confirm('确认清理所有测试业务数据？此操作不可撤销！')) return;
            try {
              const r = await api('/api/admin/maintenance/cleanup-test-business-data', { method: 'POST', body: { dryRun: false, confirm: 'CLEAR_TEST_BUSINESS_DATA' } });
              const c = r.counts;
              setNotice(`已清理：订单${c.Order} 服务器${c.Server} 钱包${c.WalletTransaction} 通知${c.Notification} 工单${c.Ticket}`);
              await load();
            } catch (e) { setNotice(e.message); }
          }}>确认清理业务数据</button>
        </div>
        <div className="admin-metrics" style={{ marginBottom: 0 }}>
          <article className="metric-card"><div><Server size={18} /></div><span>上游产品总数</span><strong>{upstreamSummary.products}</strong></article>
          <article className="metric-card"><div><PackagePlus size={18} /></div><span>待处理新增</span><strong>{upstreamSummary.newCount}</strong></article>
          <article className="metric-card"><div><Bell size={18} /></div><span>待处理变更</span><strong>{upstreamSummary.changedCount}</strong></article>
          <article className="metric-card"><div><ReceiptText size={18} /></div><span>待处理下架</span><strong>{upstreamSummary.offlineCount}</strong></article>
        </div>
      </Panel>

      <Panel title="新增购买方案"><ProductFields form={form} setForm={setForm} submitLabel="新增" onSubmit={addProduct} /></Panel>
      <DataTable pagination columns={['产品名称', '类型', '地区', '配置', '月付', '年付', '库存', '状态', '操作']} rows={rows.map((product) => [
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
      <DataTable pagination columns={['订单', '客户', '产品与消息', '类型', '金额', '支付', '开通', '操作']} rows={rows.map((order) => [
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
      <DataTable pagination columns={['服务器', '用户', 'IP', '系统', '到期', '状态', '操作']} rows={rows.map((server) => [
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
      <DataTable pagination columns={['用户信息', '联系方式', '余额', '业务概况', '状态', '操作']} rows={rows.map((user) => [
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
      <DataTable pagination columns={['工单', '用户', '状态', '更新时间', '最近内容', '操作']} rows={rows.map((ticket) => [
        <TicketTitleCell ticket={ticket} />,
        <UserIdentity user={ticket.user} compact />,
        <StatusPill value={ticket.status} labels={ticketStatusLabels} />,
        formatDate(ticket.updatedAt),
        <TicketLastReply ticket={ticket} />,
        <ActionGroup actions={[
          ['回复', () => openReply(ticket)],
          ...(ticket.status !== 'closed' ? [['关闭', () => closeTicket(ticket)]] : []),
          ...(ticket.status === 'closed' ? [['查看', () => openReply(ticket)]] : [])
        ]} />
      ])} />
    </div>
  );
}

function AdminUpstream({ api, setNotice, load }) {
  const [syncing, setSyncing] = useState(false);
  const [products, setProducts] = useState([]);
  const [diff, setDiff] = useState({ new: [], changed: [], offline: [], unchanged: [], localOnly: [] });
  const [diffTab, setDiffTab] = useState('new');
  const [selected, setSelected] = useState(new Set());
  const [merging, setMerging] = useState(false);
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [lastSync, setLastSync] = useState(null);

  const fetchProducts = async () => {
    try {
      const prods = await api('/api/admin/upstream/fastmos/products');
      setProducts(prods);
      if (prods.length > 0) {
        // Infer last sync from most recent updatedAt
        const latest = prods.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
        setLastSync(latest.updatedAt);
      }
    } catch (e) { setNotice(e.message); }
  };

  const fetchDiff = async () => {
    try {
      setDiff(await api('/api/admin/upstream/fastmos/diff'));
      setSelected(new Set());
    } catch (e) { setNotice(e.message); }
  };

  const doSync = async () => {
    setSyncing(true);
    try {
      const result = await api('/api/admin/upstream/fastmos/sync', { method: 'POST' });
      setNotice(`同步完成：拉取 ${result.fetched} 条，新增 ${result.new}，变更 ${result.changed}，下架 ${result.offline}`);
      await Promise.all([fetchProducts(), fetchDiff()]);
    } catch (e) { setNotice(e.message); }
    finally { setSyncing(false); }
  };

  const doMerge = async (action, ids) => {
    const upstreamIds = ids || Array.from(selected);
    if (upstreamIds.length === 0) { setNotice('请先勾选要操作的项目'); return; }
    setMerging(true);
    try {
      const result = await api('/api/admin/upstream/fastmos/merge', {
        method: 'POST', body: { action, upstreamIds }
      });
      setNotice(`操作完成：新增 ${result.created}，更新 ${result.updated}，忽略 ${result.ignored}，下架 ${result.offlined}`);
      setSelected(new Set());
      await Promise.all([fetchProducts(), fetchDiff(), load()]);
    } catch (e) { setNotice(e.message); }
    finally { setMerging(false); }
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  useEffect(() => { fetchProducts(); fetchDiff(); }, []);

  // ── CRUD state ──
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [crudForm, setCrudForm] = useState({});
  const [crudSaving, setCrudSaving] = useState(false);

  const emptyCrudForm = { title: '', areaGroup: '', area: '', netline: '', cpu: '', cpuCount: '1', memory: '', disk: '', diskNum: '1', diskSn: '', bandwidth: '', defense: '', priceMonthly: '', priceShow: '', stock: '0', status: 'on_sale', sortOrder: '0', netDesc: '' };

  const openCreate = () => { setCrudForm({ ...emptyCrudForm }); setCreateOpen(true); };
  const openEdit = (item) => { setCrudForm({ title: item.title || '', areaGroup: item.areaGroup || '', area: item.area || '', netline: item.netline || '', cpu: item.cpu || '', cpuCount: String(item.cpuCount || 1), memory: item.memory || '', disk: item.disk || '', diskNum: String(item.diskNum || 1), diskSn: item.diskSn || '', bandwidth: item.bandwidth || '', defense: item.defense || '', priceMonthly: String(item.priceMonthly || ''), priceShow: item.priceShow || '', stock: String(item.stock ?? 0), status: item.status || 'on_sale', sortOrder: String(item.sortOrder || 0), netDesc: item.netDesc || '' }); setEditItem(item); };

  const saveCrud = async (e) => {
    e.preventDefault();
    setCrudSaving(true);
    try {
      if (editItem) {
        await api(`/api/admin/upstream/fastmos/products/${editItem.id}`, { method: 'PUT', body: crudForm });
        setNotice('上游产品已更新');
      } else {
        await api('/api/admin/upstream/fastmos/products', { method: 'POST', body: crudForm });
        setNotice('上游产品已新增');
      }
      setCreateOpen(false); setEditItem(null);
      await Promise.all([fetchProducts(), fetchDiff()]);
    } catch (e) { setNotice(e.message); }
    finally { setCrudSaving(false); }
  };

  const doDelete = async () => {
    if (!deleteConfirm) return;
    setCrudSaving(true);
    try {
      const result = await api(`/api/admin/upstream/fastmos/products/${deleteConfirm.id}`, { method: 'DELETE', body: { action: deleteConfirm.action || 'offline' } });
      setNotice(result.action === 'offline' ? '已下架上游产品' : '已删除上游产品');
      setDeleteConfirm(null);
      await Promise.all([fetchProducts(), fetchDiff()]);
    } catch (e) { setNotice(e.message); }
    finally { setCrudSaving(false); }
  };

  const openDelete = (item) => {
    if (item.productId) {
      setDeleteConfirm({ ...item, action: 'offline' });
    } else {
      setDeleteConfirm({ ...item, action: 'force' });
    }
  };

  // ── Sync progress ──
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [showSyncLogs, setShowSyncLogs] = useState(false);
  const [syncRuns, setSyncRuns] = useState([]);
  const [showSyncHistory, setShowSyncHistory] = useState(false);

  const fetchSyncRuns = async () => {
    try { setSyncRuns(await api('/api/admin/upstream/fastmos/sync-runs')); } catch (_) {}
  };

  const pollSyncProgress = async () => {
    try {
      const data = await api('/api/admin/upstream/fastmos/sync-current');
      if (data) {
        setSyncProgress(data.run);
        setSyncLogs(data.logs || []);
      }
      return data?.syncing;
    } catch (_) { return false; }
  };

  const doSyncWithProgress = async () => {
    setSyncing(true);
    setSyncProgress(null); setSyncLogs([]);
    try {
      const result = await api('/api/admin/upstream/fastmos/sync', { method: 'POST' });
      setNotice(`同步完成：拉取 ${result.fetched} 条，新增 ${result.new}，变更 ${result.changed}，下架 ${result.offline}`);
      await Promise.all([fetchProducts(), fetchDiff(), fetchSyncRuns()]);
      // Fetch logs for completed run
      try {
        const runs = await api('/api/admin/upstream/fastmos/sync-runs');
        if (runs[0]) {
          const logs = await api(`/api/admin/upstream/fastmos/sync-runs/${runs[0].id}/logs`);
          setSyncLogs(logs);
          setSyncProgress(runs[0]);
        }
      } catch (_) {}
    } catch (e) { setNotice(e.message); }
    finally { setSyncing(false); }
  };

  const viewRunLogs = async (runId) => {
    try {
      const run = syncRuns.find((r) => r.id === runId);
      const logs = await api(`/api/admin/upstream/fastmos/sync-runs/${runId}/logs`);
      setSyncProgress(run);
      setSyncLogs(logs);
      setShowSyncLogs(true);
    } catch (e) { setNotice(e.message); }
  };

  useEffect(() => { fetchSyncRuns(); }, []);

  const stockDisplay = (stock) => {
    if (stock == null || stock === -1 || stock === '-1') return <span className="status-pill on_sale">不限</span>;
    if (stock === 0) return <span className="status-pill off_sale">售罄</span>;
    return <span>{stock}</span>;
  };

  const currentDiff = diff[diffTab] || [];
  const publishedCount = products.filter((p) => p.published).length;
  const unpublishedCount = products.filter((p) => !p.published && p.status === 'on_sale').length;

  // Filters
  const groups = [...new Set(products.map((p) => p.areaGroup || '其他'))].sort();
  const filtered = currentDiff.filter((item) => {
    if (filterGroup && (item.areaGroup || item.location || '') !== filterGroup) return false;
    if (filterStatus && item.status !== filterStatus) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const hay = [item.upstreamId, item.id, item.title, item.name, item.cpu, item.memory, item.disk, item.bandwidth, String(item.priceMonthly || ''), item.areaGroup, item.area, item.netline, item.priceShow].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const tabs = [
    ['new', '新增', diff.new?.length || 0],
    ['changed', '变更', diff.changed?.length || 0],
    ['offline', '下架', diff.offline?.length || 0],
    ['unchanged', '未变', diff.unchanged?.length || 0],
    ['localOnly', '本地独有', diff.localOnly?.length || 0]
  ];

  const formatPrice = (cents) => cents != null ? `$${(cents / 100).toFixed(0)}` : '-';

  const singleMerge = (item, action) => {
    const id = item.upstreamId || item.id;
    doMerge(action, [id]);
  };

  return (
    <div className="admin-page admin-upstream-page">
      <div className="dashboard-head">
        <h1>上游产品管理</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary" onClick={doSyncWithProgress} disabled={syncing}>
            <RefreshCw size={17} />{syncing ? (syncProgress?.status === 'running' ? '同步中...' : '同步中...') : '同步上游服务器'}
          </button>
          <button className="secondary" onClick={openCreate}><Plus size={17} />新增上游产品</button>
          <button className="secondary" onClick={() => { fetchSyncRuns(); setShowSyncHistory(true); }}>同步历史</button>
        </div>
      </div>

      {/* Sync progress indicator */}
      {syncing && syncProgress && (
        <div className="admin-upstream-sync-progress">
          <div className="sync-progress-bar">
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span>同步进行中... 已抓取 {syncProgress.fetchedCount || 0} 台</span>
            <span className="muted" style={{ fontSize: '0.8rem' }}>耗时 {Math.floor(((Date.now() - new Date(syncProgress.startedAt).getTime()) / 1000))}s</span>
            <button className="table-action" onClick={async () => {
              const stillRunning = await pollSyncProgress();
              if (stillRunning) setNotice('同步仍在进行中...');
            }}>刷新进度</button>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div className="admin-upstream-status">
        <div className="admin-upstream-status-item">
          <span>上游总数</span><strong>{products.length}</strong>
        </div>
        <div className="admin-upstream-status-item">
          <span>已发布</span><strong>{publishedCount}</strong>
        </div>
        <div className="admin-upstream-status-item">
          <span>未发布</span><strong>{unpublishedCount}</strong>
        </div>
        <div className="admin-upstream-status-item">
          <span>待新增</span><strong className="text-green">{diff.new?.length || 0}</strong>
        </div>
        <div className="admin-upstream-status-item">
          <span>待变更</span><strong className="text-orange">{diff.changed?.length || 0}</strong>
        </div>
        <div className="admin-upstream-status-item">
          <span>待下架</span><strong className="text-red">{diff.offline?.length || 0}</strong>
        </div>
        {lastSync && (
          <div className="admin-upstream-status-item">
            <span>上次同步</span><strong>{new Date(lastSync).toLocaleString('zh-HK', { hour12: false })}</strong>
          </div>
        )}
      </div>

      {/* Diff tabs */}
      <div className="filter-section">
        <div className="filter-tabs">
          {tabs.map(([key, label, count]) => (
            <button key={key} className={`filter-tab ${diffTab === key ? 'active' : ''}`} onClick={() => { setDiffTab(key); setSelected(new Set()); setFilterGroup(''); setFilterStatus(''); setSearchText(''); }}>
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Filters & search */}
      <div className="admin-upstream-filters">
        <select value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
          <option value="">全部产品组</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        {diffTab !== 'localOnly' && (
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">全部状态</option>
            <option value="on_sale">在售</option>
            <option value="off_sale">下架</option>
            <option value="offline">已下线</option>
          </select>
        )}
        <div className="admin-search" style={{ flex: 1, maxWidth: 300 }}>
          <Search size={16} />
          <input placeholder="搜索ID/标题/CPU/内存/硬盘/带宽/价格/线路..." value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
      </div>

      {/* Batch actions */}
      {diffTab !== 'unchanged' && diffTab !== 'localOnly' && filtered.length > 0 && (
        <div className="upstream-merge-actions">
          {(diffTab === 'new') && <button className="primary" onClick={() => doMerge('create')} disabled={merging}>批量合并为产品</button>}
          {(diffTab === 'changed') && <button className="primary" onClick={() => doMerge('update')} disabled={merging}>批量更新产品</button>}
          {(diffTab === 'new' || diffTab === 'changed') && <button className="secondary" onClick={() => doMerge('ignore')} disabled={merging}>批量忽略</button>}
          {diffTab === 'offline' && <button className="secondary" onClick={() => doMerge('offline')} disabled={merging}>批量下架</button>}
          <span className="muted" style={{ marginLeft: 8 }}>已选 {selected.size} 项</span>
        </div>
      )}

      {/* Table */}
      {filtered.length > 0 ? (
        <DataTable pagination
          columns={['', '产品信息', '产品组/线路', '配置', '价格', '发布状态', '操作']}
          rows={filtered.map((item) => {
            const id = item.upstreamId || item.id;
            const isLocal = diffTab === 'localOnly';
            const isNew = diffTab === 'new';
            const isChanged = diffTab === 'changed';
            const isOffline = diffTab === 'offline';
            return [
              !isLocal ? <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} /> : '',
              <div className="admin-upstream-title"><strong>{item.title || item.name || '-'}</strong><small>ID: {item.upstreamId || item.id?.slice(-8)}</small></div>,
              `${item.areaGroup || item.location || '-'} / ${item.area || ''}`,
              `${item.cpu || '-'} / ${item.memory || '-'} / ${item.disk || '-'} / ${item.bandwidth || '-'}`,
              <span>{formatPrice(item.priceMonthly)} {item.priceShow ? <small className="muted">({item.priceShow})</small> : ''}</span>,
              isLocal ? <StatusPill value={item.status} labels={{ on_sale: '在售', off_sale: '已下架' }} /> :
              item.published ? <span className="status-pill on_sale">已关联产品</span> :
              item.status === 'offline' ? <span className="status-pill off_sale">已下架</span> :
              <span className="status-pill expiring">未关联</span>,
              <ActionGroup actions={[
                ['详情', () => setDetailItem(item)],
                ['编辑', () => openEdit(item)],
                ...(isNew ? [['合并', () => singleMerge(item, 'create')], ['忽略', () => singleMerge(item, 'ignore')]] : []),
                ...(isChanged ? [['更新', () => singleMerge(item, 'update')], ['忽略', () => singleMerge(item, 'ignore')]] : []),
                ...(isOffline ? [['下架', () => singleMerge(item, 'offline')]] : []),
                ['删除', () => openDelete(item)]
              ]} />
            ];
          })}
        />
      ) : (
        <div className="admin-upstream-empty">
          <p>{currentDiff.length === 0
            ? (diffTab === 'new' ? '暂无新增产品，可点击"同步上游服务器"刷新目录。' : '暂无数据。')
            : '没有匹配筛选条件的产品。'}</p>
        </div>
      )}

      {/* Detail modal */}
      {detailItem && (
        <Modal title="上游产品详情" onClose={() => setDetailItem(null)}>
          <div className="admin-upstream-detail">
            <div className="detail-grid">
              <span>上游ID</span><strong>{detailItem.upstreamId}</strong>
              <span>来源</span><strong>{detailItem.sourceId || '-'}</strong>
              <span>产品组</span><strong>{detailItem.areaGroup || '-'}</strong>
              <span>区域/线路</span><strong>{detailItem.area || '-'} / {detailItem.netline || '-'}</strong>
              <span>CPU</span><strong>{detailItem.cpu || '-'} x {detailItem.cpuCount || 1}</strong>
              <span>内存</span><strong>{detailItem.memory || '-'}</strong>
              <span>硬盘</span><strong>{detailItem.disk || '-'} / {detailItem.diskSn || ''}</strong>
              <span>带宽</span><strong>{detailItem.bandwidth || '-'}</strong>
              <span>防御</span><strong>{detailItem.defense || '-'}</strong>
              <span>月付</span><strong>{formatPrice(detailItem.priceMonthly)}</strong>
              <span>库存</span><strong>{detailItem.stock === -1 ? '不限' : detailItem.stock}</strong>
              <span>状态</span><StatusPill value={detailItem.status} labels={{ on_sale: '在售', off_sale: '下架', offline: '已下线' }} />
              <span>关联产品</span><strong>{detailItem.productId || '未关联'}</strong>
              <span>创建时间</span><strong>{formatDate(detailItem.createdAt)}</strong>
              <span>更新时间</span><strong>{formatDate(detailItem.updatedAt)}</strong>
            </div>
            {detailItem.rawJson && (
              <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '0.85rem' }}>原始 JSON</summary>
                <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: '0.75rem', background: '#f8fafc', padding: 10, borderRadius: 6, marginTop: 8 }}>{(() => { try { return JSON.stringify(JSON.parse(detailItem.rawJson), null, 2); } catch { return detailItem.rawJson; } })()}</pre>
              </details>
            )}
          </div>
        </Modal>
      )}

      {/* Create/Edit modal */}
      {(createOpen || editItem) && (
        <Modal title={editItem ? '编辑上游产品' : '新增上游产品'} onClose={() => { setCreateOpen(false); setEditItem(null); }}>
          <form className="modal-form" onSubmit={saveCrud}>
            <fieldset><legend>基础信息</legend>
              <label>标题<input value={crudForm.title} onChange={(e) => setCrudForm((p) => ({ ...p, title: e.target.value }))} required /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>产品组<input value={crudForm.areaGroup} onChange={(e) => setCrudForm((p) => ({ ...p, areaGroup: e.target.value }))} /></label>
                <label>区域<input value={crudForm.area} onChange={(e) => setCrudForm((p) => ({ ...p, area: e.target.value }))} /></label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>线路<input value={crudForm.netline} onChange={(e) => setCrudForm((p) => ({ ...p, netline: e.target.value }))} /></label>
                <label>netDesc<input value={crudForm.netDesc} onChange={(e) => setCrudForm((p) => ({ ...p, netDesc: e.target.value }))} /></label>
              </div>
            </fieldset>
            <fieldset><legend>配置</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>CPU型号<input value={crudForm.cpu} onChange={(e) => setCrudForm((p) => ({ ...p, cpu: e.target.value }))} /></label>
                <label>CPU数量<input type="number" value={crudForm.cpuCount} onChange={(e) => setCrudForm((p) => ({ ...p, cpuCount: e.target.value }))} /></label>
              </div>
              <label>内存<input value={crudForm.memory} onChange={(e) => setCrudForm((p) => ({ ...p, memory: e.target.value }))} placeholder="如 32GB" /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label>硬盘容量<input value={crudForm.disk} onChange={(e) => setCrudForm((p) => ({ ...p, disk: e.target.value }))} /></label>
                <label>硬盘数量<input type="number" value={crudForm.diskNum} onChange={(e) => setCrudForm((p) => ({ ...p, diskNum: e.target.value }))} /></label>
                <label>硬盘类型<input value={crudForm.diskSn} onChange={(e) => setCrudForm((p) => ({ ...p, diskSn: e.target.value }))} /></label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>带宽<input value={crudForm.bandwidth} onChange={(e) => setCrudForm((p) => ({ ...p, bandwidth: e.target.value }))} /></label>
                <label>防御<input value={crudForm.defense} onChange={(e) => setCrudForm((p) => ({ ...p, defense: e.target.value }))} /></label>
              </div>
            </fieldset>
            <fieldset><legend>价格与库存</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label>月付(分)<input type="number" value={crudForm.priceMonthly} onChange={(e) => setCrudForm((p) => ({ ...p, priceMonthly: e.target.value }))} /></label>
                <label>显示价格<input value={crudForm.priceShow} onChange={(e) => setCrudForm((p) => ({ ...p, priceShow: e.target.value }))} /></label>
                <label>库存(-1=不限)<input type="number" value={crudForm.stock} onChange={(e) => setCrudForm((p) => ({ ...p, stock: e.target.value }))} /></label>
              </div>
            </fieldset>
            <fieldset><legend>状态与排序</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>状态<select value={crudForm.status} onChange={(e) => setCrudForm((p) => ({ ...p, status: e.target.value }))}><option value="on_sale">在售</option><option value="off_sale">下架</option></select></label>
                <label>排序<input type="number" value={crudForm.sortOrder} onChange={(e) => setCrudForm((p) => ({ ...p, sortOrder: e.target.value }))} /></label>
              </div>
            </fieldset>
            <button className="primary" type="submit" disabled={crudSaving}>{crudSaving ? '保存中...' : (editItem ? '保存修改' : '新增产品')}</button>
          </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <Modal title="确认操作" onClose={() => setDeleteConfirm(null)}>
          <div style={{ marginBottom: 16 }}>
            <p>{deleteConfirm.productId ? '该上游产品已关联本站产品，建议下架处理。' : '确认删除此上游产品？'}</p>
            <p className="muted" style={{ fontSize: '0.85rem' }}>产品: {deleteConfirm.title}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="secondary" onClick={() => setDeleteConfirm(null)}>取消</button>
            {deleteConfirm.productId && (
              <button className="primary" onClick={() => { deleteConfirm.action = 'unlink-delete'; doDelete(); }} disabled={crudSaving}>解绑后删除</button>
            )}
            <button className="secondary" onClick={() => { deleteConfirm.action = 'offline'; doDelete(); }} disabled={crudSaving}>仅下架</button>
            {!deleteConfirm.productId && (
              <button className="primary" onClick={doDelete} disabled={crudSaving} style={{ background: 'var(--red)' }}>确认删除</button>
            )}
          </div>
        </Modal>
      )}

      {/* Sync log viewer */}
      {showSyncLogs && syncProgress && (
        <Modal title={`同步日志 (${syncProgress.id?.slice(-8)})`} onClose={() => setShowSyncLogs(false)}>
          <div className="admin-upstream-log-viewer">
            <div className="sync-log-meta">
              <span>状态: {syncProgress.status}</span>
              <span>抓取: {syncProgress.fetchedCount || 0}</span>
              <span>新增: {syncProgress.newCount || 0}</span>
              <span>耗时: {syncProgress.endedAt ? `${Math.round((new Date(syncProgress.endedAt) - new Date(syncProgress.startedAt)) / 1000)}s` : '进行中'}</span>
            </div>
            <div className="sync-log-list">
              {syncLogs.map((log) => (
                <div key={log.id} className={`sync-log-line ${log.level}`}>
                  <span className="sync-log-time">{new Date(log.createdAt).toLocaleTimeString('zh-HK', { hour12: false })}</span>
                  <span className={`sync-log-level ${log.level}`}>{log.level}</span>
                  <span className="sync-log-step">[{log.step}]</span>
                  <span className="sync-log-msg">{log.message}</span>
                </div>
              ))}
              {syncLogs.length === 0 && <p className="muted">暂无日志</p>}
            </div>
            <button className="table-action" onClick={async () => {
              try {
                const logs = await api(`/api/admin/upstream/fastmos/sync-runs/${syncProgress.id}/logs`);
                setSyncLogs(logs);
              } catch (_) {}
            }} style={{ marginTop: 10 }}>刷新</button>
          </div>
        </Modal>
      )}

      {/* Sync history */}
      {showSyncHistory && (
        <Modal title="同步历史 (最近20次)" onClose={() => setShowSyncHistory(false)}>
          <div className="responsive-table">
            <table>
              <thead><tr><th>时间</th><th>状态</th><th>抓取</th><th>新增</th><th>变更</th><th>下架</th><th>错误</th><th>日志</th></tr></thead>
              <tbody>
                {syncRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{formatDate(run.startedAt)}</td>
                    <td><span className={`status-pill ${run.status === 'success' ? 'on_sale' : run.status === 'running' ? 'expiring' : 'off_sale'}`}>{run.status}</span></td>
                    <td>{run.fetchedCount}</td>
                    <td>{run.newCount}</td>
                    <td>{run.changedCount}</td>
                    <td>{run.offlineCount}</td>
                    <td>{run.errorCount || 0}</td>
                    <td><button className="table-action" onClick={() => viewRunLogs(run.id)}>查看</button></td>
                  </tr>
                ))}
                {syncRuns.length === 0 && <tr><td colSpan={8} className="empty-cell">暂无同步记录</td></tr>}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
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
    overdue_suspend_days: '逾期暂停天数',
    sales_contact_title: '客服弹窗标题',
    sales_contact_text: '客服弹窗说明',
    sales_contact_phone: '客服电话',
    sales_contact_wechat: '客服微信',
    sales_contact_qr_url: '客服二维码URL',
    sales_contact_phone_enabled: '显示电话',
    sales_contact_wechat_enabled: '显示微信',
    sales_contact_email_enabled: '显示邮箱',
    sales_contact_telegram_enabled: '显示Telegram',
    sales_contact_qr_enabled: '显示二维码',
    sales_contact_telegram: 'Telegram账号',
    sales_contact_telegram_url: 'Telegram链接',
    operation_log_retention_days: '操作日志保留天数'
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
      <DataTable pagination columns={['动作', '目标', '管理员', '时间', '详情']} rows={rows.map((log) => [log.action, `${log.targetType}:${log.targetId || '-'}`, log.admin?.username || '-', formatDate(log.createdAt), log.detail || '-'])} />
    </div>
  );
}

export { AdminPortal, AdminLogin, AdminDashboard };
