import React, { useEffect, useState } from 'react';
import {
  Bell, Boxes, Check, ChevronDown, CircleDollarSign, Cloud, LayoutDashboard,
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

function AdminSelect({ value, onChange, options, ariaLabel = '选择', className = '' }) {
  const [open, setOpen] = useState(false);
  const normalized = options.map((option) => Array.isArray(option)
    ? { value: option[0], label: option[1] }
    : option);
  const selected = normalized.find((option) => String(option.value) === String(value)) || normalized[0] || { value: '', label: '-' };

  return (
    <div className={`admin-select-control ${className}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button type="button" className="admin-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((next) => !next)}>
        <span>{selected.label}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="admin-select-menu" role="listbox" tabIndex={-1}>
          {normalized.map((option) => (
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
              {String(option.value) === String(value) && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ admin, navigate, refreshAdmin, setNotice, refreshProducts, refreshSiteSettings, route }) {
  const section = getAdminSection(route);
  const [adminFilter, setAdminFilter] = useState('');
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [data, setData] = useState({ summary: {}, users: [], products: [], orders: [], servers: [], tickets: [], logs: [], settings: [] });
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [serverForm, setServerForm] = useState({ mode: 'order', orderId: '', userId: '', productId: '', name: '', ip: '', ipv6: '', extraIps: '', os: 'Ubuntu 22.04', loginUser: 'root', loginPassword: '', sshPort: '22', panelUrl: '', panelUser: '', panelPassword: '', region: '', networkLine: '', bandwidth: '', defense: '', nameservers: '', deliveryNote: '', adminNote: '', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) });
  const [rechargeForm, setRechargeForm] = useState({ open: false, user: null, amount: '', remark: '' });
  const [replyForm, setReplyForm] = useState({ open: false, ticket: null, content: '' });
  const [userForm, setUserForm] = useState({ open: false, user: null, email: '', phone: '', status: 'active' });
  const [productEditForm, setProductEditForm] = useState({ open: false, product: null, values: emptyProductForm });
  const [serverEditForm, setServerEditForm] = useState({ open: false, server: null, values: {} });
  const [passwordForm, setPasswordForm] = useState({ open: false, currentPassword: '', newPassword: '', confirmPassword: '' });
  const [orderMessageForm, setOrderMessageForm] = useState({ open: false, order: null, content: '' });
  const [refundForm, setRefundForm] = useState({ open: false, order: null, remark: '' });
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
      const result = await api('/api/admin/upstream/fastmos/fetch-preview', { method: 'POST' });
      setNotice(result.runId ? '获取任务已启动，请到产品管理查看预览。' : '获取任务已提交');
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
    if (action === 'refund') {
      setRefundForm({ open: true, order, remark: '' });
      return;
    }
    try {
      await api(`/api/admin/orders/${order.id}/${action}`, { method: 'POST' });
      await load();
    } catch (error) { setNotice(error.message); }
  };

  const submitRefund = async (e) => {
    e.preventDefault();
    if (!refundForm.order) return;
    try {
      await api(`/api/admin/orders/${refundForm.order.id}/refund`, { method: 'POST', body: { confirm: true, remark: refundForm.remark } });
      setNotice(`订单 ${refundForm.order.orderNo} 已退款`);
      setRefundForm({ open: false, order: null, remark: '' });
      await load();
    } catch (error) { setNotice(error.message); }
  };

  const openProvisionFromOrder = (order) => {
    setServerForm((prev) => ({
      ...prev,
      mode: 'order',
      orderId: order.id,
      name: order.product?.name || order.orderNo,
      os: prev.os || 'Ubuntu 22.04',
      loginUser: prev.loginUser || 'root'
    }));
    navigate('/admin/servers');
    setNotice(`正在为订单 ${order.orderNo} 开通服务器，请填写 IP 和密码后提交`);
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
    const body = {};
    if (serverForm.mode === 'order') {
      body.orderId = serverForm.orderId;
    } else {
      body.userId = serverForm.userId;
      if (serverForm.productId?.startsWith('upstream:')) body.upstreamProductId = serverForm.productId.slice('upstream:'.length);
      else if (serverForm.productId?.startsWith('local:')) body.productId = serverForm.productId.slice('local:'.length);
      else body.productId = serverForm.productId;
    }
    const copyFields = ['name', 'ip', 'ipv6', 'extraIps', 'os', 'loginUser', 'loginPassword', 'sshPort', 'panelUrl', 'panelUser', 'panelPassword', 'region', 'networkLine', 'bandwidth', 'defense', 'nameservers', 'deliveryNote', 'adminNote', 'expiresAt'];
    for (const f of copyFields) { if (serverForm[f]) body[f] = serverForm[f]; }
    try {
      await api('/api/admin/servers', { method: 'POST', body });
      setServerForm((prev) => ({ ...prev, name: '', ip: '', loginPassword: '', panelPassword: '', ipv6: '', extraIps: '', deliveryNote: '', adminNote: '' }));
      await load();
      setNotice('服务器已开通');
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
      ipv6: server.ipv6 || '',
      extraIps: server.extraIps || '',
      os: server.os || '',
      loginUser: server.loginUser || '',
      loginPassword: '',
      sshPort: String(server.sshPort ?? 22),
      panelUrl: server.panelUrl || '',
      panelUser: server.panelUser || '',
      panelPassword: '',
      region: server.region || '',
      networkLine: server.networkLine || '',
      bandwidth: server.bandwidth || '',
      defense: server.defense || '',
      nameservers: server.nameservers || '',
      deliveryNote: server.deliveryNote || '',
      adminNote: server.adminNote || '',
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
        {(section === 'products' || section === 'upstream') && <MergedProductsPage products={data.products} keyword={adminFilter} form={productForm} setForm={setProductForm} addProduct={addProduct} updateProductStatus={updateProductStatus} openProductEdit={openProductEdit} upstreamSummary={upstreamSummary} syncUpstreamOriginal={syncUpstream} cleanupTestProducts={cleanupTestProducts} syncing={syncing} navigate={navigate} api={api} setNotice={setNotice} load={load} />}
        {section === 'orders' && <AdminOrders orders={data.orders} keyword={adminFilter} markPaid={markPaid} orderAction={orderAction} openOrderMessage={(order) => setOrderMessageForm({ open: true, order, content: '' })} openProvision={openProvisionFromOrder} />}
        {section === 'servers' && <AdminServers servers={data.servers} keyword={adminFilter} orders={pendingPaidOrders} users={data.users} products={data.products} form={serverForm} setForm={setServerForm} openServer={openServer} openServerEdit={openServerEdit} serverAction={serverAction} api={api} setNotice={setNotice} />}
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
              <label>状态<AdminSelect value={userForm.status} onChange={(value) => setUserForm((prev) => ({ ...prev, status: value }))} options={[['active', '正常'], ['disabled', '已禁用']]} ariaLabel="用户状态" /></label>
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
            <form className="modal-form server-edit-form" onSubmit={submitServerEdit}>
              <fieldset className="form-fieldset"><legend>基础信息</legend>
                <label>名称<input value={serverEditForm.values.name || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, name: e.target.value } }))} required /></label>
                <div className="form-row">
                  <label>主 IP<input value={serverEditForm.values.ip || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, ip: e.target.value } }))} required /></label>
                  <label>IPv6<input value={serverEditForm.values.ipv6 || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, ipv6: e.target.value } }))} /></label>
                </div>
                <label>附加 IP（多行）<textarea rows="2" value={serverEditForm.values.extraIps || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, extraIps: e.target.value } }))} /></label>
                <div className="form-row">
                  <label>系统<input value={serverEditForm.values.os || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, os: e.target.value } }))} /></label>
                  <label>状态<AdminSelect value={serverEditForm.values.status || 'running'} onChange={(value) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, status: value } }))} options={[['running', '运行中'], ['suspended', '已暂停'], ['expired', '已到期'], ['expiring', '即将到期']]} ariaLabel="服务器状态" /></label>
                </div>
              </fieldset>
              <fieldset className="form-fieldset"><legend>登录信息</legend>
                <div className="form-row">
                  <label>SSH 用户<input value={serverEditForm.values.loginUser || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, loginUser: e.target.value } }))} /></label>
                  <label>SSH 端口<input type="number" min="1" max="65535" value={serverEditForm.values.sshPort || '22'} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, sshPort: e.target.value } }))} /></label>
                </div>
                <label>新密码（留空不修改）<input type="text" value={serverEditForm.values.loginPassword || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, loginPassword: e.target.value } }))} placeholder="不填写则不修改" /></label>
              </fieldset>
              <fieldset className="form-fieldset"><legend>网络资源</legend>
                <div className="form-row">
                  <label>地区<input value={serverEditForm.values.region || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, region: e.target.value } }))} /></label>
                  <label>线路<input value={serverEditForm.values.networkLine || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, networkLine: e.target.value } }))} /></label>
                </div>
                <div className="form-row">
                  <label>带宽<input value={serverEditForm.values.bandwidth || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, bandwidth: e.target.value } }))} /></label>
                  <label>防御<input value={serverEditForm.values.defense || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, defense: e.target.value } }))} /></label>
                </div>
                <label>DNS / Nameserver（多行）<textarea rows="2" value={serverEditForm.values.nameservers || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, nameservers: e.target.value } }))} /></label>
              </fieldset>
              <fieldset className="form-fieldset"><legend>面板与说明</legend>
                <label>控制面板 URL<input value={serverEditForm.values.panelUrl || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, panelUrl: e.target.value } }))} /></label>
                <div className="form-row">
                  <label>面板账号<input value={serverEditForm.values.panelUser || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, panelUser: e.target.value } }))} /></label>
                  <label>面板密码（留空不修改）<input type="text" value={serverEditForm.values.panelPassword || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, panelPassword: e.target.value } }))} placeholder="不填写则不修改" /></label>
                </div>
                <label>给用户的开通说明<textarea rows="3" value={serverEditForm.values.deliveryNote || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, deliveryNote: e.target.value } }))} /></label>
                <label>后台内部备注<textarea rows="2" value={serverEditForm.values.adminNote || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, adminNote: e.target.value } }))} /></label>
              </fieldset>
              <fieldset className="form-fieldset"><legend>到期时间</legend>
                <label>到期时间<input type="date" value={serverEditForm.values.expiresAt || ''} onChange={(e) => setServerEditForm((prev) => ({ ...prev, values: { ...prev.values, expiresAt: e.target.value } }))} /></label>
              </fieldset>
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
        {refundForm.open && (
          <Modal title="确认退款" onClose={() => setRefundForm({ open: false, order: null, remark: '' })}>
            <div style={{ marginBottom: 16 }}>
              <div className="detail-grid">
                <span>订单号</span><strong>{refundForm.order.orderNo}</strong>
                <span>用户</span><strong>{refundForm.order.user?.username || '-'}</strong>
                <span>产品</span><strong>{refundForm.order.product?.name || '-'}</strong>
                <span>退款金额</span><strong>{formatMoney(refundForm.order.amount)}</strong>
                <span>支付状态</span><StatusPill value={refundForm.order.payStatus} labels={payStatusLabels} />
              </div>
              <p className="muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>退款将把金额退回用户余额，并生成钱包流水。</p>
            </div>
            <form className="modal-form" onSubmit={submitRefund}>
              <label>退款备注（可选）<input value={refundForm.remark} onChange={e => setRefundForm(p => ({ ...p, remark: e.target.value }))} placeholder="退款原因" /></label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="secondary" type="button" onClick={() => setRefundForm({ open: false, order: null, remark: '' })}>取消</button>
                <button className="primary" type="submit">确认退款</button>
              </div>
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

// Merged: /admin/products + /admin/upstream in tabs
function MergedProductsPage({ products, keyword, form, setForm, addProduct, updateProductStatus, openProductEdit, upstreamSummary, syncUpstreamOriginal, cleanupTestProducts, syncing, navigate, api, setNotice, load }) {
  const [tab, setTab] = useState('upstream');
  const [upProducts, setUpProducts] = useState([]);
  const [diff, setDiff] = useState({ new: [], changed: [], offline: [], unchanged: [], localOnly: [] });
  const [diffTab, setDiffTab] = useState('new');
  const [selected, setSelected] = useState(new Set());
  const [merging, setMerging] = useState(false);
  const [filterGroup, setFilterGroup] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncLogs, setSyncLogs] = useState([]);
  const [syncRuns, setSyncRuns] = useState([]);
  const [showSyncLogs, setShowSyncLogs] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [crudForm, setCrudForm] = useState({});
  const [crudSaving, setCrudSaving] = useState(false);
  const [localProductAction, setLocalProductAction] = useState(null);
  const [_syncing2, _setSyncing2] = useState(false);
  const [syncPoller, setSyncPoller] = useState(null);

  const emptyCrudForm = { title: '', areaGroup: '', area: '', netline: '', cpu: '', cpuCount: '1', memory: '', disk: '', diskNum: '1', diskSn: '', bandwidth: '', defense: '', priceMonthly: '', priceShow: '', stock: '0', status: 'on_sale', sortOrder: '0', netDesc: '' };
  const formatPrice = (cents) => cents != null ? `$${(cents / 100).toFixed(0)}` : '-';
  const stockDisplay = (s) => (s == null || s === -1) ? <span className="status-pill on_sale">不限</span> : s === 0 ? <span className="status-pill off_sale">售罄</span> : <span>{s}</span>;

  const fetchUpProducts = async () => {
    try { setUpProducts(await api('/api/admin/upstream/fastmos/products')); } catch (_) {}
  };
  const fetchDiff = async () => {
    try { setDiff(await api('/api/admin/upstream/fastmos/diff')); setSelected(new Set()); } catch (_) {}
  };
  const fetchSyncRuns = async () => {
    try { setSyncRuns(await api('/api/admin/upstream/fastmos/sync-runs')); } catch (_) {}
  };

  const syncUpstream = async () => {
    _setSyncing2(true);
    setSyncProgress(null); setSyncLogs([]);
    // Clear any old poller
    if (syncPoller) clearInterval(syncPoller);
    try {
      const result = await api('/api/admin/upstream/fastmos/fetch-preview', { method: 'POST' });
      if (result.runId) {
        const runId = result.runId;
        setSyncProgress({ id: runId, status: 'running', startedAt: new Date().toISOString() });
        setNotice('获取任务已启动，正在后台拉取上游数据...');
        const timer = setInterval(async () => {
          try {
            const run = await api(`/api/admin/upstream/fastmos/sync-runs/${runId}`);
            const logs = await api(`/api/admin/upstream/fastmos/sync-runs/${runId}/logs`);
            if (run) {
              setSyncProgress(run);
              setSyncLogs(logs || []);
              const done = ['pending_review', 'success', 'failed', 'cancelled'].includes(run.status);
              if (done) {
                clearInterval(timer); _setSyncing2(false);
                if (run.status === 'pending_review') {
                  setNotice(`获取完成：${run.fetchedCount || 0} 台，待审核。`);
                  setTab('preview');
                } else if (run.status === 'failed') {
                  setNotice(`获取失败：${run.errorMessage || '未知错误'}`);
                }
                await Promise.all([fetchUpProducts(), fetchDiff(), fetchSyncRuns(), load()]);
              }
            } else { clearInterval(timer); _setSyncing2(false); }
          } catch { clearInterval(timer); _setSyncing2(false); }
        }, 2000);
        setSyncPoller(timer);
      }
    } catch (e) { setNotice(e.message); _setSyncing2(false); }
  };

  useEffect(() => { fetchUpProducts(); fetchDiff(); fetchSyncRuns(); return () => { if (syncPoller) clearInterval(syncPoller); }; }, []);

  // CRUD
  const openCreate = () => { setCrudForm({ ...emptyCrudForm }); setCreateOpen(true); };
  const openEdit = (item) => { setCrudForm({ title: item.title || '', areaGroup: item.areaGroup || '', area: item.area || '', netline: item.netline || '', cpu: item.cpu || '', cpuCount: String(item.cpuCount || 1), memory: item.memory || '', disk: item.disk || '', diskNum: String(item.diskNum || 1), diskSn: item.diskSn || '', bandwidth: item.bandwidth || '', defense: item.defense || '', priceMonthly: String(item.priceMonthly || ''), priceShow: item.priceShow || '', stock: String(item.stock ?? 0), status: item.status || 'on_sale', sortOrder: String(item.sortOrder || 0), netDesc: item.netDesc || '' }); setEditItem(item); };
  const saveCrud = async (e) => { e.preventDefault(); setCrudSaving(true); try { if (editItem) { await api(`/api/admin/upstream/fastmos/products/${editItem.id}`, { method: 'PUT', body: crudForm }); setNotice('已更新'); } else { await api('/api/admin/upstream/fastmos/products', { method: 'POST', body: crudForm }); setNotice('已新增'); } setCreateOpen(false); setEditItem(null); await Promise.all([fetchUpProducts(), fetchDiff()]); } catch (e2) { setNotice(e2.message); } finally { setCrudSaving(false); } };
  const doDeleteUpstream = async () => { if (!deleteConfirm) return; setCrudSaving(true); try { const result = await api(`/api/admin/upstream/fastmos/products/${deleteConfirm.id}`, { method: 'DELETE', body: { action: deleteConfirm.action || 'offline' } }); setNotice(result.action === 'offline' ? '已下架' : '已删除'); setDeleteConfirm(null); await Promise.all([fetchUpProducts(), fetchDiff()]); } catch (e2) { setNotice(e2.message); } finally { setCrudSaving(false); } };
  const openDeleteUpstream = (item) => { setDeleteConfirm(item.productId ? { ...item, action: 'offline' } : { ...item, action: 'force' }); };

  // localOnly operations
  const openLocalProductAction = (item, action) => { setLocalProductAction({ item, action }); };
  const doLocalProductAction = async () => {
    if (!localProductAction) return;
    const { item, action } = localProductAction;
    try {
      if (action === 'delete') {
        await api(`/api/admin/products/${item.id}`, { method: 'DELETE' });
        setNotice('已删除产品');
      } else if (action === 'off_sale') {
        await api(`/api/admin/products/${item.id}/off-sale`, { method: 'POST' });
        setNotice('已下架产品');
      }
      setLocalProductAction(null);
      await Promise.all([load(), fetchDiff()]);
    } catch (e2) { setNotice(e2.message); setLocalProductAction(null); }
  };
  const editLocalProduct = (item) => { openProductEdit(item); };

  // Merge
  const doMerge = async (action, ids) => {
    const upstreamIds = ids || Array.from(selected);
    if (upstreamIds.length === 0) { setNotice('请先勾选'); return; }
    setMerging(true);
    try {
      const result = await api('/api/admin/upstream/fastmos/merge', { method: 'POST', body: { action, upstreamIds } });
      setNotice(`完成：新增${result.created} 更新${result.updated} 忽略${result.ignored} 下架${result.offlined}`);
      setSelected(new Set());
      await Promise.all([fetchUpProducts(), fetchDiff(), load()]);
    } catch (e2) { setNotice(e2.message); } finally { setMerging(false); }
  };
  const singleMerge = (item, action) => doMerge(action, [item.upstreamId || item.id]);
  const toggleSelect = (id) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); };

  // Sync logs
  const [previewItems, setPreviewItems] = useState([]);
  const [previewRunId, setPreviewRunId] = useState(null);
  const viewRunPreview = async (runId) => {
    try {
      const items = await api(`/api/admin/upstream/fastmos/sync-runs/${runId}/preview`);
      setPreviewItems(items);
      setPreviewRunId(runId);
    } catch (e) { setNotice(e.message); }
  };
  const applyPreview = async (runId, mode) => {
    try {
      const result = await api(`/api/admin/upstream/fastmos/sync-runs/${runId}/apply`, { method: 'POST', body: { applyMode: mode } });
      setNotice(`已应用 ${result.applied} 项${result.failed > 0 ? `，${result.failed} 项失败` : ''}`);
      await Promise.all([fetchUpProducts(), fetchDiff(), fetchSyncRuns(), load()]);
    } catch (e) { setNotice(e.message); }
  };
  const viewRunLogs = async (runId) => {
    try {
      const run = syncRuns.find(r => r.id === runId);
      const logs = await api(`/api/admin/upstream/fastmos/sync-runs/${runId}/logs`);
      setSyncProgress(run); setSyncLogs(logs); setShowSyncLogs(true);
    } catch (e2) { setNotice(e2.message); }
  };

  // Filter
  const currentDiff = diff[diffTab] || [];
  const groups = [...new Set(upProducts.map(p => p.areaGroup || '其他'))].sort();
  const filtered = currentDiff.filter(item => {
    if (filterGroup && (item.areaGroup || item.location || '') !== filterGroup) return false;
    if (filterStatus && item.status !== filterStatus) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const hay = [item.upstreamId, item.id, item.title, item.name, item.cpu, item.memory, item.disk, item.bandwidth, String(item.priceMonthly || ''), item.areaGroup, item.area, item.netline, item.priceShow].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const publishedCount = upProducts.filter(p => p.published).length;
  const unpublishedCount = upProducts.filter(p => !p.published && p.status === 'on_sale').length;

  const tabs = [['new', '新增', diff.new?.length || 0], ['changed', '变更', diff.changed?.length || 0], ['offline', '下架', diff.offline?.length || 0], ['unchanged', '未变', diff.unchanged?.length || 0], ['localOnly', '本地独有', diff.localOnly?.length || 0]];
  const pageTabs = ['上游产品', '本站产品', '差异处理', '获取预览', '获取记录', '危险操作'];

  // For localOnly: identify product status
  const getLocalProductStatus = (item) => {
    if (!item.orders) return '无订单';
    return item.orders.length > 0 ? `有${item.orders.length}个订单` : '无订单';
  };

  return (
    <div className="admin-page admin-upstream-page">
      <div className="dashboard-head">
        <h1>产品管理</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary" onClick={syncUpstream} disabled={_syncing2}>
            <RefreshCw size={17} />{_syncing2 ? '获取中...' : '获取上游数据'}
          </button>
          <button className="secondary" onClick={openCreate}><Plus size={17} />新增上游产品</button>
          <button className="secondary" onClick={cleanupTestProducts}>清理测试产品</button>
          <button className="secondary" onClick={() => { setTab('danger'); }}>危险操作</button>
        </div>
      </div>

      {/* Sync progress */}
      {_syncing2 && syncProgress && (
        <div className="admin-upstream-sync-progress">
          <div className="sync-progress-bar">
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span>获取中... {syncProgress.fetchedCount ? `已抓取 ${syncProgress.fetchedCount} 台` : ''}</span>
            {syncProgress.startedAt && <span className="muted" style={{ fontSize: '0.8rem' }}>耗时 {Math.floor((Date.now() - new Date(syncProgress.startedAt).getTime()) / 1000)}s</span>}
            {syncLogs.length > 0 && <span className="muted" style={{ fontSize: '0.82rem' }}>最近: {syncLogs[syncLogs.length - 1]?.message?.slice(0, 60)}</span>}
          </div>
        </div>
      )}

      {/* Page tabs */}
      <div className="filter-section">
        <div className="filter-tabs">
          {pageTabs.map((t) => (
            <button key={t} className={`filter-tab ${(tab === 'upstream' && t === '上游产品') || (tab === 'local' && t === '本站产品') || (tab === 'diff' && t === '差异处理') || (tab === 'preview' && t === '获取预览') || (tab === 'logs' && t === '获取记录') || (tab === 'danger' && t === '危险操作') ? 'active' : ''}`}
              onClick={() => { setTab(t === '上游产品' ? 'upstream' : t === '本站产品' ? 'local' : t === '差异处理' ? 'diff' : t === '获取预览' ? 'preview' : t === '危险操作' ? 'danger' : 'logs'); setSelected(new Set()); }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* === UPSTREAM TAB === */}
      {tab === 'upstream' && (
        <>
          <div className="admin-upstream-status">
            <div className="admin-upstream-status-item"><span>上游总数</span><strong>{upProducts.length}</strong></div>
            <div className="admin-upstream-status-item"><span>已发布</span><strong>{publishedCount}</strong></div>
            <div className="admin-upstream-status-item"><span>未发布</span><strong>{unpublishedCount}</strong></div>
            <div className="admin-upstream-status-item"><span>待新增</span><strong className="text-green">{diff.new?.length || 0}</strong></div>
            <div className="admin-upstream-status-item"><span>待变更</span><strong className="text-orange">{diff.changed?.length || 0}</strong></div>
            <div className="admin-upstream-status-item"><span>待下架</span><strong className="text-red">{diff.offline?.length || 0}</strong></div>
          </div>
          <div className="admin-upstream-filters">
            <AdminSelect value={filterGroup} onChange={setFilterGroup} options={[['', '全部产品组'], ...groups.map((group) => [group, group])]} ariaLabel="产品组筛选" />
            <AdminSelect value={filterStatus} onChange={setFilterStatus} options={[['', '全部状态'], ['on_sale', '在售'], ['off_sale', '下架'], ['offline', '已下线']]} ariaLabel="状态筛选" />
            <div className="admin-search" style={{ flex: 1, maxWidth: 300 }}><Search size={16} /><input placeholder="搜索..." value={searchText} onChange={e => setSearchText(e.target.value)} /></div>
          </div>
          <DataTable pagination columns={[
            <input type="checkbox" onChange={(e) => {
              const all = upProducts.filter(p => { /* apply same filters */ return true; });
              if (e.target.checked) setSelected(new Set(all.map(p => p.upstreamId)));
              else setSelected(new Set());
            }} title="全选" />,
            '产品信息', '产品组/线路', '配置', '价格', '库存', '发布状态', '操作']}
            rows={upProducts.filter(p => {
              if (filterGroup && (p.areaGroup || '') !== filterGroup) return false;
              if (filterStatus && p.status !== filterStatus) return false;
              if (searchText) { const q = searchText.toLowerCase(); const h = [p.upstreamId, p.title, p.cpu, p.memory, p.disk, p.bandwidth, String(p.priceMonthly || ''), p.areaGroup, p.area, p.netline].join(' ').toLowerCase(); if (!h.includes(q)) return false; }
              return true;
            }).map(item => [
              <input type="checkbox" checked={selected.has(item.upstreamId)} onChange={() => toggleSelect(item.upstreamId)} />,
              <div className="admin-upstream-title"><strong>{item.title || '-'}</strong><small>ID: {item.upstreamId}</small></div>,
              `${item.areaGroup || '-'} / ${item.area || ''}`,
              `${item.cpu || '-'} / ${item.memory || '-'} / ${item.disk || '-'}`,
              formatPrice(item.priceMonthly),
              stockDisplay(item.stock),
              item.published ? <span className="status-pill on_sale">已关联</span> : item.status === 'offline' ? <span className="status-pill off_sale">已下架</span> : <span className="status-pill expiring">未关联</span>,
              <ActionGroup actions={[['详情', () => setDetailItem(item)], ['编辑', () => openEdit(item)], ...(item.status === 'on_sale' && !item.published ? [['合并', () => singleMerge(item, 'create')], ['忽略', () => singleMerge(item, 'ignore')]] : []), ['删除', () => openDeleteUpstream(item)]]} />
            ])}
          />
          {selected.size > 0 && (
            <div className="upstream-merge-actions">
              <button className="primary" onClick={() => doMerge('create')} disabled={merging}>批量合并</button>
              <button className="secondary" onClick={() => doMerge('ignore')} disabled={merging}>批量忽略</button>
              <span className="muted">已选 {selected.size} 项</span>
            </div>
          )}
        </>
      )}

      {/* === LOCAL PRODUCTS TAB === */}
      {tab === 'local' && (
        <>
          <Panel title="新增购买方案"><ProductFields form={form} setForm={setForm} submitLabel="新增" onSubmit={addProduct} /></Panel>
          <DataTable pagination columns={['产品名称', '类型', '地区', '配置', '月付', '年付', '库存', '状态', '操作']}
            rows={products.filter(p => [p.name, p.type, p.location, p.cpu, p.memory, p.disk, p.bandwidth, p.status].some(v => textIncludes(v, keyword))).map(p => [
              p.name, p.type, p.location, `${p.cpu} / ${p.memory} / ${p.disk}`, formatMoney(p.priceMonthly), formatMoney(p.priceYearly), p.stock,
              <StatusPill value={p.status} labels={productStatusLabels} />,
              <ActionGroup actions={[['编辑', () => openProductEdit(p)], [p.status === 'on_sale' ? '下架' : '上架', () => updateProductStatus(p, p.status === 'on_sale' ? 'off_sale' : 'on_sale')]]} />
            ])}
          />
        </>
      )}

      {/* === DIFF TAB === */}
      {tab === 'diff' && (
        <>
          <div className="filter-section">
            <div className="filter-tabs">
              {tabs.map(([key, label, count]) => (
                <button key={key} className={`filter-tab ${diffTab === key ? 'active' : ''}`} onClick={() => { setDiffTab(key); setSelected(new Set()); setFilterGroup(''); setFilterStatus(''); setSearchText(''); }}>
                  {label} ({count})
                </button>
              ))}
            </div>
          </div>
          <div className="admin-upstream-filters">
            <AdminSelect value={filterGroup} onChange={setFilterGroup} options={[['', '全部产品组'], ...groups.map((group) => [group, group])]} ariaLabel="产品组筛选" />
            {diffTab !== 'localOnly' && <AdminSelect value={filterStatus} onChange={setFilterStatus} options={[['', '全部状态'], ['on_sale', '在售'], ['off_sale', '下架']]} ariaLabel="状态筛选" />}
            <div className="admin-search" style={{ flex: 1, maxWidth: 300 }}><Search size={16} /><input placeholder="搜索..." value={searchText} onChange={e => setSearchText(e.target.value)} /></div>
          </div>

          {diffTab !== 'unchanged' && diffTab !== 'localOnly' && filtered.length > 0 && (
            <div className="upstream-merge-actions">
              {diffTab === 'new' && <button className="primary" onClick={() => doMerge('create')} disabled={merging}>批量合并</button>}
              {diffTab === 'changed' && <button className="primary" onClick={() => doMerge('update')} disabled={merging}>批量更新</button>}
              {diffTab === 'new' && <button className="secondary" onClick={() => doMerge('ignore')} disabled={merging}>批量忽略</button>}
              {diffTab === 'offline' && <button className="primary" onClick={() => doMerge('offline')} disabled={merging}>批量下架</button>}
              <span className="muted">已选 {selected.size} 项</span>
            </div>
          )}

          {filtered.length > 0 ? (
            <DataTable pagination columns={diffTab === 'localOnly' ? ['', '产品名称', '地区', '配置', '月付', '状态', '订单', '操作'] : ['', '产品信息', '产品组/线路', '配置', '价格', '状态', '操作']}
              rows={filtered.map(item => {
                const id = item.upstreamId || item.id;
                const isLocal = diffTab === 'localOnly';
                if (isLocal) {
                  return [
                    '', item.name || '-', item.location || '-', `${item.cpu} / ${item.memory} / ${item.disk}`, formatMoney(item.priceMonthly),
                    <StatusPill value={item.status} labels={productStatusLabels} />,
                    item.orders?.length || 0,
                    <ActionGroup actions={[['编辑', () => editLocalProduct(item)], ['下架', () => openLocalProductAction(item, 'off_sale')], ...(item.orders?.length === 0 ? [['删除', () => openLocalProductAction(item, 'delete')]] : [])]} />
                  ];
                }
                return [
                  <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} />,
                  <div className="admin-upstream-title"><strong>{item.title || item.name || '-'}</strong><small>ID: {item.upstreamId || ''}</small></div>,
                  `${item.areaGroup || item.location || '-'} / ${item.area || ''}`,
                  `${item.cpu || '-'} / ${item.memory || '-'} / ${item.disk || '-'}`,
                  formatPrice(item.priceMonthly),
                  item.published ? <span className="status-pill on_sale">已发布</span> : item.status === 'offline' ? <span className="status-pill off_sale">已下线</span> : <span className="status-pill expiring">未发布</span>,
                  <ActionGroup actions={[...(diffTab === 'new' ? [['合并', () => singleMerge(item, 'create')], ['忽略', () => singleMerge(item, 'ignore')]] : []), ...(diffTab === 'changed' ? [['更新', () => singleMerge(item, 'update')]] : []), ...(diffTab === 'offline' ? [['下架', () => singleMerge(item, 'offline')]] : [])]} />
                ];
              })}
            />
          ) : (
            <div className="admin-upstream-empty"><p>{currentDiff.length === 0 ? (diffTab === 'new' ? '暂无新增，点击获取上游数据刷新。' : '暂无数据。') : '没有匹配筛选条件。'}</p></div>
          )}
        </>
      )}

      {/* === PREVIEW TAB === */}
      {tab === 'preview' && (
        <>
          <h3 style={{ margin: '0 0 14px' }}>最近获取预览</h3>
          {syncRuns.length === 0 ? <p className="muted">暂无获取记录，请先点击"获取上游数据"。</p> : (
            <DataTable pagination columns={['时间', '状态', '抓取', '新增', '变更', '下架', '操作']}
              rows={syncRuns.slice(0, 10).map(run => [
                formatDate(run.startedAt),
                <span className={`status-pill ${run.status === 'pending_review' ? 'expiring' : run.status === 'applied' ? 'on_sale' : run.status === 'running' ? 'expiring' : 'off_sale'}`}>{run.status === 'pending_review' ? '待审核' : run.status === 'applied' ? '已应用' : run.status}</span>,
                run.fetchedCount, run.newCount, run.changedCount, run.offlineCount,
                <ActionGroup actions={[
                  ['查看预览', () => viewRunPreview(run.id)],
                  ...(run.status === 'pending_review' ? [['应用全部新增/变更', () => applyPreview(run.id, 'all_new_changed')]] : []),
                  ['查看日志', () => viewRunLogs(run.id)]
                ]} />
              ])}
            />
          )}
        </>
      )}

      {/* === DANGER TAB === */}
      {tab === 'danger' && (
        <>
          <Panel title="危险操作">
            <p className="muted" style={{ marginBottom: 16 }}>以下操作不可逆，请谨慎使用。</p>
            <ClearAllProductsPanel api={api} setNotice={setNotice} load={load} />
          </Panel>
        </>
      )}

      {/* Preview items modal */}
      {previewItems.length > 0 && (
        <Modal title={`获取预览 (${previewRunId?.slice(-8)})`} onClose={() => setPreviewItems([])}>
          <div className="responsive-table" style={{ maxHeight: '50vh', overflow: 'auto' }}>
            <table>
              <thead><tr><th>类型</th><th>标题</th><th>区域/线路</th><th>CPU</th><th>价格</th><th>操作</th></tr></thead>
              <tbody>
                {previewItems.map(pv => (
                  <tr key={pv.id} style={pv.action === 'unchanged' ? { opacity: 0.5 } : {}}>
                    <td><span className={`status-pill ${pv.action === 'new' ? 'on_sale' : pv.action === 'changed' ? 'expiring' : pv.action === 'offline' ? 'off_sale' : ''}`}>{pv.action === 'new' ? '新增' : pv.action === 'changed' ? '变更' : pv.action === 'offline' ? '下线' : '不变'}</span></td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{pv.title || '-'}</td>
                    <td>{pv.areaGroup || '-'} / {pv.area || ''}</td>
                    <td>{pv.cpu || '-'}</td>
                    <td>{pv.priceShow ? `$${pv.priceShow}` : '-'}</td>
                    <td>{!pv.applied && pv.action !== 'unchanged' && <button className="table-action" onClick={() => applyPreview(previewRunId, 'selected', [pv.id])}>应用</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* === SYNC LOGS TAB === */}
      {tab === 'logs' && (
        <>
          <h3 style={{ margin: '0 0 14px' }}>获取记录 (最近20次)</h3>
          <DataTable pagination columns={['时间', '状态', '抓取', '新增', '变更', '下架', '错误', '日志']}
            rows={syncRuns.map(run => [
              formatDate(run.startedAt),
              <span className={`status-pill ${run.status === 'success' ? 'on_sale' : run.status === 'running' ? 'expiring' : 'off_sale'}`}>{run.status}</span>,
              run.fetchedCount, run.newCount, run.changedCount, run.offlineCount, run.errorCount || 0,
              <button className="table-action" onClick={() => viewRunLogs(run.id)}>查看</button>
            ])}
          />
        </>
      )}

      {/* === SHARED MODALS === */}
      {detailItem && (
        <Modal title="上游产品详情" onClose={() => setDetailItem(null)}>
          <div className="admin-upstream-detail">
            <div className="detail-grid">
              <span>上游ID</span><strong>{detailItem.upstreamId}</strong>
              <span>产品组</span><strong>{detailItem.areaGroup || '-'}</strong>
              <span>区域/线路</span><strong>{detailItem.area || '-'} / {detailItem.netline || '-'}</strong>
              <span>CPU</span><strong>{detailItem.cpu || '-'} x {detailItem.cpuCount || 1}</strong>
              <span>内存</span><strong>{detailItem.memory || '-'}</strong>
              <span>硬盘</span><strong>{detailItem.disk || '-'} / {detailItem.diskSn || ''}</strong>
              <span>带宽</span><strong>{detailItem.bandwidth || '-'}</strong>
              <span>月付</span><strong>{formatPrice(detailItem.priceMonthly)}</strong>
              <span>库存</span><strong>{detailItem.stock === -1 ? '不限' : detailItem.stock}</strong>
              <span>状态</span><StatusPill value={detailItem.status} labels={{ on_sale: '在售', off_sale: '下架', offline: '已下线' }} />
              <span>关联产品</span><strong>{detailItem.productId || '未关联'}</strong>
              <span>创建</span><strong>{formatDate(detailItem.createdAt)}</strong>
            </div>
            {detailItem.rawJson && (
              <details style={{ marginTop: 14 }}><summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: '0.85rem' }}>原始 JSON</summary>
                <pre style={{ maxHeight: 200, overflow: 'auto', fontSize: '0.75rem', background: '#f8fafc', padding: 10, borderRadius: 6, marginTop: 8 }}>{(() => { try { return JSON.stringify(JSON.parse(detailItem.rawJson), null, 2); } catch { return detailItem.rawJson; } })()}</pre>
              </details>
            )}
          </div>
        </Modal>
      )}

      {(createOpen || editItem) && (
        <Modal title={editItem ? '编辑上游产品' : '新增上游产品'} onClose={() => { setCreateOpen(false); setEditItem(null); }}>
          <form className="modal-form" onSubmit={saveCrud}>
            <fieldset><legend>基础信息</legend>
              <label>标题<input value={crudForm.title} onChange={e => setCrudForm(p => ({ ...p, title: e.target.value }))} required /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label>产品组<input value={crudForm.areaGroup} onChange={e => setCrudForm(p => ({ ...p, areaGroup: e.target.value }))} /></label><label>区域<input value={crudForm.area} onChange={e => setCrudForm(p => ({ ...p, area: e.target.value }))} /></label></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label>线路<input value={crudForm.netline} onChange={e => setCrudForm(p => ({ ...p, netline: e.target.value }))} /></label><label>netDesc<input value={crudForm.netDesc} onChange={e => setCrudForm(p => ({ ...p, netDesc: e.target.value }))} /></label></div>
            </fieldset>
            <fieldset><legend>配置</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label>CPU型号<input value={crudForm.cpu} onChange={e => setCrudForm(p => ({ ...p, cpu: e.target.value }))} /></label><label>CPU数量<input type="number" value={crudForm.cpuCount} onChange={e => setCrudForm(p => ({ ...p, cpuCount: e.target.value }))} /></label></div>
              <label>内存<input value={crudForm.memory} onChange={e => setCrudForm(p => ({ ...p, memory: e.target.value }))} /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}><label>硬盘容量<input value={crudForm.disk} onChange={e => setCrudForm(p => ({ ...p, disk: e.target.value }))} /></label><label>硬盘数量<input type="number" value={crudForm.diskNum} onChange={e => setCrudForm(p => ({ ...p, diskNum: e.target.value }))} /></label><label>硬盘类型<input value={crudForm.diskSn} onChange={e => setCrudForm(p => ({ ...p, diskSn: e.target.value }))} /></label></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label>带宽<input value={crudForm.bandwidth} onChange={e => setCrudForm(p => ({ ...p, bandwidth: e.target.value }))} /></label><label>防御<input value={crudForm.defense} onChange={e => setCrudForm(p => ({ ...p, defense: e.target.value }))} /></label></div>
            </fieldset>
            <fieldset><legend>价格与库存</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}><label>月付(分)<input type="number" value={crudForm.priceMonthly} onChange={e => setCrudForm(p => ({ ...p, priceMonthly: e.target.value }))} /></label><label>显示价格<input value={crudForm.priceShow} onChange={e => setCrudForm(p => ({ ...p, priceShow: e.target.value }))} /></label><label>库存(-1不限)<input type="number" value={crudForm.stock} onChange={e => setCrudForm(p => ({ ...p, stock: e.target.value }))} /></label></div>
            </fieldset>
            <fieldset><legend>状态</legend>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><label>状态<AdminSelect value={crudForm.status} onChange={(value) => setCrudForm(p => ({ ...p, status: value }))} options={[['on_sale', '在售'], ['off_sale', '下架']]} ariaLabel="上游产品状态" /></label><label>排序<input type="number" value={crudForm.sortOrder} onChange={e => setCrudForm(p => ({ ...p, sortOrder: e.target.value }))} /></label></div>
            </fieldset>
            <button className="primary" type="submit" disabled={crudSaving}>{crudSaving ? '保存中...' : (editItem ? '保存修改' : '新增产品')}</button>
          </form>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal title="确认操作" onClose={() => setDeleteConfirm(null)}>
          <p>{deleteConfirm.productId ? '该上游产品已关联本站产品，建议下架。' : '确认删除此上游产品？'}</p>
          <p className="muted">{deleteConfirm.title}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="secondary" onClick={() => setDeleteConfirm(null)}>取消</button>
            {deleteConfirm.productId && <button className="primary" onClick={() => { setDeleteConfirm(p => ({ ...p, action: 'unlink-delete' })); doDeleteUpstream(); }}>解绑后删除</button>}
            <button className="secondary" onClick={() => { setDeleteConfirm(p => ({ ...p, action: 'offline' })); doDeleteUpstream(); }}>仅下架</button>
            {!deleteConfirm.productId && <button className="primary" onClick={doDeleteUpstream} style={{ background: 'var(--red)' }}>确认删除</button>}
          </div>
        </Modal>
      )}

      {localProductAction && (
        <Modal title={localProductAction.action === 'delete' ? '确认删除产品' : '确认下架产品'} onClose={() => setLocalProductAction(null)}>
          <p><strong>{localProductAction.item.name}</strong></p>
          {localProductAction.action === 'delete' && <p>该产品无关联订单，可以安全删除。</p>}
          {localProductAction.action === 'off_sale' && <p>下架后产品将不在前台展示。</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="secondary" onClick={() => setLocalProductAction(null)}>取消</button>
            <button className="primary" onClick={doLocalProductAction}>{localProductAction.action === 'delete' ? '确认删除' : '确认下架'}</button>
          </div>
        </Modal>
      )}

      {showSyncLogs && syncProgress && (
        <Modal title={`获取日志 (${syncProgress.id?.slice(-8)})`} onClose={() => setShowSyncLogs(false)}>
          <div className="admin-upstream-log-viewer">
            <div className="sync-log-meta">
              <span>状态: {syncProgress.status}</span>
              <span>抓取: {syncProgress.fetchedCount || 0}</span>
              <span>新增: {syncProgress.newCount || 0}</span>
              {syncProgress.endedAt && <span>耗时: {Math.round((new Date(syncProgress.endedAt) - new Date(syncProgress.startedAt)) / 1000)}s</span>}
            </div>
            <div className="sync-log-list">
              {syncLogs.map(log => (
                <div key={log.id} className={`sync-log-line ${log.level}`}>
                  <span className="sync-log-time">{new Date(log.createdAt).toLocaleTimeString('zh-HK', { hour12: false })}</span>
                  <span className={`sync-log-level ${log.level}`}>{log.level}</span>
                  <span className="sync-log-step">[{log.step}]</span>
                  <span className="sync-log-msg">{log.message}</span>
                </div>
              ))}
            </div>
            <button className="table-action" style={{ marginTop: 10 }} onClick={async () => { try { setSyncLogs(await api(`/api/admin/upstream/fastmos/sync-runs/${syncProgress.id}/logs`)); } catch (_) {} }}>刷新</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ClearAllProductsPanel({ api, setNotice, load }) {
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [forceClean, setForceClean] = useState(false);
  const [includeUpstream, setIncludeUpstream] = useState(false);

  const doClear = async (e) => {
    e.preventDefault();
    if (confirmText !== 'CLEAR_PRODUCTS') { setNotice('请正确输入确认文本 CLEAR_PRODUCTS'); return; }
    setClearing(true);
    try {
      const result = await api('/api/admin/products/clear-all', { method: 'POST', body: { password, confirmText, scope: includeUpstream ? 'all' : 'local', forceCleanBusinessData: forceClean, includeUpstream } });
      setNotice(`已清空：删除 ${result.deleted} 个，归档 ${result.archived} 个，跳过 ${result.skipped} 个`);
      setPassword(''); setConfirmText('');
      await load();
    } catch (e) { setNotice(e.message); }
    finally { setClearing(false); }
  };

  return (
    <form className="modal-form" onSubmit={doClear}>
      <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>清空所有本地产品。有关联订单/服务器的产品将被下架而非删除。</p>
      <label>管理员密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      <label>输入 CLEAR_PRODUCTS 确认<input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="CLEAR_PRODUCTS" required /></label>
      <label className="remember"><input type="checkbox" checked={forceClean} onChange={e => setForceClean(e.target.checked)} /> 同时清理关联的订单/服务器/钱包流水（级联删除）</label>
      <label className="remember"><input type="checkbox" checked={includeUpstream} onChange={e => setIncludeUpstream(e.target.checked)} /> 同时清空上游产品（/servers 将无数据展示）</label>
      <button className="primary" type="submit" disabled={clearing} style={{ background: 'var(--red)' }}>{clearing ? '执行中...' : '确认清空所有产品'}</button>
    </form>
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

function AdminServers({ servers, keyword, orders, users, products, form, setForm, openServer, openServerEdit, serverAction, api, setNotice }) {
  const [upstreamProducts, setUpstreamProducts] = useState([]);

  useEffect(() => {
    if (!form.orderId && orders[0]) setForm((prev) => ({ ...prev, mode: 'order', orderId: orders[0].id, name: orders[0].product?.name || '' }));
  }, [orders, form.orderId, setForm]);

  useEffect(() => {
    if (orders.length === 0 && form.mode === 'order') {
      setForm((prev) => ({ ...prev, mode: 'manual', orderId: '' }));
    }
  }, [orders.length, form.mode, setForm]);

  useEffect(() => {
    api('/api/admin/upstream/fastmos/products')
      .then((items) => setUpstreamProducts(items.filter((item) => item.status === 'on_sale')))
      .catch((error) => setNotice?.(`上游产品加载失败：${error.message}`));
  }, [api, setNotice]);

  const selectedOrder = form.orderId ? orders.find((o) => o.id === form.orderId) : null;
  const activeUsers = users.filter((u) => u.status === 'active');
  const productOptions = [
    ...products
      .filter((p) => p.status === 'on_sale')
      .map((p) => [`local:${p.id}`, `本站：${p.name}`]),
    ...upstreamProducts.map((p) => [
      `upstream:${p.id}`,
      `上游：${p.title || p.upstreamId} / ${[p.areaGroup, p.area, p.netline].filter(Boolean).join(' / ') || '未分组'}`
    ])
  ];
  const applySelectedProduct = (value) => {
    update('productId', value);
    if (value?.startsWith('upstream:')) {
      const item = upstreamProducts.find((p) => p.id === value.slice('upstream:'.length));
      if (item) {
        setForm((prev) => ({
          ...prev,
          productId: value,
          name: prev.name || item.title || '',
          region: prev.region || item.areaGroup || item.area || '',
          networkLine: prev.networkLine || item.netline || '',
          bandwidth: prev.bandwidth || item.bandwidth || '',
          defense: prev.defense || item.defense || ''
        }));
      }
    } else if (value?.startsWith('local:')) {
      const item = products.find((p) => p.id === value.slice('local:'.length));
      if (item) {
        setForm((prev) => ({
          ...prev,
          productId: value,
          name: prev.name || item.name || '',
          region: prev.region || item.location || '',
          bandwidth: prev.bandwidth || item.bandwidth || '',
          defense: prev.defense || item.defense || ''
        }));
      }
    }
  };

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const rows = servers.filter((server) => [server.name, server.user?.username, server.ip, server.os, server.status, server.product?.name, server.region, server.networkLine].some((value) => textIncludes(value, keyword)));

  return (
    <div className="admin-page">
      <h1>服务器管理</h1>

      {/* Pending orders for quick provisioning */}
      {orders.length > 0 && (
        <Panel title="待开通订单">
          <div className="pending-orders-list">
            {orders.map((order) => (
              <div className={`pending-order-item ${form.orderId === order.id ? 'selected' : ''}`} key={order.id} onClick={() => setForm((prev) => ({ ...prev, mode: 'order', orderId: order.id, name: order.product?.name || order.orderNo }))}>
                <strong>{order.orderNo}</strong>
                <span>{order.user?.username}</span>
                <span>{order.product?.name || '-'}</span>
                <span>{formatMoney(order.amount)}</span>
                <StatusPill value={order.payStatus} labels={payStatusLabels} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Provision form */}
      <Panel title={form.mode === 'order' && selectedOrder ? `正在为订单 ${selectedOrder.orderNo} 开通服务器` : '开通服务器'}>
        <form className="admin-form product-form server-provision-form" onSubmit={openServer}>
          {/* Mode selector */}
          <div className="form-group form-group-full">
            <label>开通方式</label>
            <AdminSelect value={form.mode || 'order'} onChange={(value) => update('mode', value)} options={[['order', '从订单开通'], ['manual', '手动给用户开通']]} ariaLabel="开通方式" />
          </div>

          {/* Order selection (from order mode) */}
          {form.mode === 'order' && (
            <div className="form-group form-group-full provision-context">
              <label>选择待开通订单</label>
              <AdminSelect value={form.orderId} onChange={(value) => { update('orderId', value); const o = orders.find((x) => x.id === value); if (o) update('name', o.product?.name || ''); }} options={orders.map((order) => [order.id, `${order.orderNo} / ${order.user?.username} / ${order.product?.name || '-'}`])} ariaLabel="选择待开通订单" />
              {selectedOrder && <p className="form-hint">用户：{selectedOrder.user?.username} | 产品：{selectedOrder.product?.name || '-'} | 金额：{formatMoney(selectedOrder.amount)}</p>}
            </div>
          )}

          {/* User & Product selection (manual mode) */}
          {form.mode === 'manual' && (
            <>
              <div className="form-group">
                <label>选择用户</label>
                <AdminSelect value={form.userId} onChange={(value) => update('userId', value)} options={activeUsers.map((u) => [u.id, `${u.username} (${u.email})`])} ariaLabel="选择用户" />
              </div>
              <div className="form-group">
                <label>选择产品</label>
                <AdminSelect value={form.productId} onChange={applySelectedProduct} options={productOptions} ariaLabel="选择产品" />
                {!productOptions.length && <p className="form-hint danger">暂无可选产品。请先在产品管理中应用上游产品，或新增本站产品。</p>}
              </div>
            </>
          )}

          {/* ── Basic Info ── */}
          <fieldset className="form-fieldset"><legend>基础信息</legend>
            <div className="form-row">
              <div className="form-group"><label>服务器名称</label><input placeholder="例如：香港 BGP 云服务器" value={form.name} onChange={(e) => update('name', e.target.value)} required /></div>
              <div className="form-group"><label>系统</label><input placeholder="例如：CentOS 7 / Ubuntu 22.04" value={form.os} onChange={(e) => update('os', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>主 IP</label><input placeholder="1.2.3.4" value={form.ip} onChange={(e) => update('ip', e.target.value)} required /></div>
              <div className="form-group"><label>IPv6</label><input placeholder="可选" value={form.ipv6} onChange={(e) => update('ipv6', e.target.value)} /></div>
            </div>
            <div className="form-group form-group-full"><label>附加 IP（每行一个）</label><textarea rows="2" placeholder="1.2.3.5&#10;1.2.3.6" value={form.extraIps} onChange={(e) => update('extraIps', e.target.value)} /></div>
          </fieldset>

          {/* ── Login Info ── */}
          <fieldset className="form-fieldset"><legend>登录信息</legend>
            <div className="form-row">
              <div className="form-group"><label>SSH 用户</label><input placeholder="root" value={form.loginUser} onChange={(e) => update('loginUser', e.target.value)} /></div>
              <div className="form-group"><label>SSH 密码</label><input type="text" placeholder="登录密码" value={form.loginPassword} onChange={(e) => update('loginPassword', e.target.value)} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>SSH 端口</label><input type="number" min="1" max="65535" placeholder="22" value={form.sshPort} onChange={(e) => update('sshPort', e.target.value)} /></div>
            </div>
          </fieldset>

          {/* ── Network ── */}
          <fieldset className="form-fieldset"><legend>网络资源</legend>
            <div className="form-row">
              <div className="form-group"><label>地区</label><input placeholder="例如：中国香港" value={form.region} onChange={(e) => update('region', e.target.value)} /></div>
              <div className="form-group"><label>线路</label><input placeholder="例如：CN2/BGP" value={form.networkLine} onChange={(e) => update('networkLine', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>带宽</label><input placeholder="例如：100M" value={form.bandwidth} onChange={(e) => update('bandwidth', e.target.value)} /></div>
              <div className="form-group"><label>防御</label><input placeholder="例如：10G" value={form.defense} onChange={(e) => update('defense', e.target.value)} /></div>
            </div>
            <div className="form-group form-group-full"><label>DNS / Nameserver（每行一个）</label><textarea rows="2" placeholder="ns1.example.com&#10;ns2.example.com" value={form.nameservers} onChange={(e) => update('nameservers', e.target.value)} /></div>
          </fieldset>

          {/* ── Panel & Delivery ── */}
          <fieldset className="form-fieldset"><legend>面板与说明</legend>
            <div className="form-row">
              <div className="form-group"><label>控制面板 URL</label><input placeholder="https://..." value={form.panelUrl} onChange={(e) => update('panelUrl', e.target.value)} /></div>
              <div className="form-group"><label>面板账号</label><input placeholder="admin" value={form.panelUser} onChange={(e) => update('panelUser', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>面板密码</label><input type="text" placeholder="面板密码" value={form.panelPassword} onChange={(e) => update('panelPassword', e.target.value)} /></div>
            </div>
            <div className="form-group form-group-full"><label>给用户的开通说明（deliveryNote）</label><textarea rows="3" placeholder="例如：请尽快修改默认密码，控制面板地址见上..." value={form.deliveryNote} onChange={(e) => update('deliveryNote', e.target.value)} /></div>
            <div className="form-group form-group-full"><label>后台内部备注（adminNote，不给用户看）</label><textarea rows="2" placeholder="内部备注..." value={form.adminNote} onChange={(e) => update('adminNote', e.target.value)} /></div>
          </fieldset>

          {/* ── Expiry ── */}
          <fieldset className="form-fieldset"><legend>到期与备注</legend>
            <div className="form-row">
              <div className="form-group"><label>到期时间</label><input type="date" value={form.expiresAt} onChange={(e) => update('expiresAt', e.target.value)} required /></div>
            </div>
          </fieldset>

          <button className="primary" type="submit"><PackagePlus size={17} />开通服务器</button>
        </form>
      </Panel>

      {/* Server list */}
      <DataTable pagination columns={['服务器', '用户', 'IP', '地区/线路', '系统', '到期', '状态', '操作']} rows={rows.map((server) => [
        <div className="meta-stack"><strong>{server.name}</strong><small>{server.product?.name || '-'}</small></div>,
        server.user?.username,
        <div className="meta-stack"><span>{server.ip}</span>{server.ipv6 ? <small>{server.ipv6}</small> : null}</div>,
        [server.region, server.networkLine].filter(Boolean).join(' / ') || '-',
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
      const result = await api('/api/admin/upstream/fastmos/fetch-preview', { method: 'POST' });
      setNotice(result.runId ? '获取任务已启动，请查看获取记录。' : '获取任务已提交');
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
      const runs = await api('/api/admin/upstream/fastmos/sync-runs');
      const latest = runs?.[0];
      if (latest) {
        const logs = await api(`/api/admin/upstream/fastmos/sync-runs/${latest.id}/logs`);
        setSyncProgress(latest);
        setSyncLogs(logs || []);
      }
      return latest?.status === 'running';
    } catch (_) { return false; }
  };

  const doSyncWithProgress = async () => {
    setSyncing(true);
    setSyncProgress(null); setSyncLogs([]);
    try {
      const result = await api('/api/admin/upstream/fastmos/fetch-preview', { method: 'POST' });
      setNotice(result.runId ? '获取任务已启动，请在获取记录中查看进度。' : '获取任务已提交');
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
            <RefreshCw size={17} />{syncing ? '获取中...' : '获取上游数据'}
          </button>
          <button className="secondary" onClick={openCreate}><Plus size={17} />新增上游产品</button>
          <button className="secondary" onClick={() => { fetchSyncRuns(); setShowSyncHistory(true); }}>获取记录</button>
        </div>
      </div>

      {/* Sync progress indicator */}
      {syncing && syncProgress && (
        <div className="admin-upstream-sync-progress">
          <div className="sync-progress-bar">
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span>获取进行中... 已抓取 {syncProgress.fetchedCount || 0} 台</span>
            <span className="muted" style={{ fontSize: '0.8rem' }}>耗时 {Math.floor(((Date.now() - new Date(syncProgress.startedAt).getTime()) / 1000))}s</span>
            <button className="table-action" onClick={async () => {
              const stillRunning = await pollSyncProgress();
              if (stillRunning) setNotice('获取仍在进行中...');
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
            <span>上次获取</span><strong>{new Date(lastSync).toLocaleString('zh-HK', { hour12: false })}</strong>
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
        <AdminSelect value={filterGroup} onChange={setFilterGroup} options={[['', '全部产品组'], ...groups.map((group) => [group, group])]} ariaLabel="产品组筛选" />
        {diffTab !== 'localOnly' && (
          <AdminSelect value={filterStatus} onChange={setFilterStatus} options={[['', '全部状态'], ['on_sale', '在售'], ['off_sale', '下架'], ['offline', '已下线']]} ariaLabel="状态筛选" />
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
            ? (diffTab === 'new' ? '暂无新增产品，可点击"获取上游数据"刷新目录。' : '暂无数据。')
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
                <label>状态<AdminSelect value={crudForm.status} onChange={(value) => setCrudForm((p) => ({ ...p, status: value }))} options={[['on_sale', '在售'], ['off_sale', '下架']]} ariaLabel="上游产品状态" /></label>
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
        <Modal title={`获取日志 (${syncProgress.id?.slice(-8)})`} onClose={() => setShowSyncLogs(false)}>
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
        <Modal title="获取记录 (最近20次)" onClose={() => setShowSyncHistory(false)}>
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
                {syncRuns.length === 0 && <tr><td colSpan={8} className="empty-cell">暂无获取记录</td></tr>}
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
