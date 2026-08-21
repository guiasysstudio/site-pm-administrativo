import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { normalizeEmail, statusBadgeClass, statusLabel } from './lib/utils';
import { Shell } from './components/Shell';
import { Modal } from './components/Modal';
import './styles.css';

type Admin = { email: string; name: string; status: string; isMaster?: boolean; permissions: Record<string, boolean> };

const OP_PERMISSIONS = [
  ['approveRejectPM', 'Aprovar/recusar PM'],
  ['activateInactivatePM', 'Ativar/inativar PM'],
  ['viewPMFullProfile', 'Ver cadastro completo do PM'],
  ['createMission', 'Criar missão'],
  ['editMission', 'Editar missão'],
  ['deleteMission', 'Excluir missão'],
  ['generateList', 'Gerar lista'],
  ['replacePM', 'Substituir PM'],
  ['publishList', 'Publicar lista'],
  ['completeMission', 'Concluir missão'],
  ['cancelMission', 'Cancelar missão'],
  ['evaluatePM', 'Avaliar PM'],
  ['manageCriteria', 'Gerenciar critérios'],
  ['exportList', 'Exportar lista'],
  ['viewMessages', 'Ver mensagens'],
  ['replyMessages', 'Responder mensagens'],
  ['sendMessageToPM', 'Enviar mensagem para PM'],
  ['sendMessageToAll', 'Enviar mensagem para todos']
] as const;

const ADM_PERMISSIONS = [
  ['manageAdmins', 'Gerenciar ADMs'],
  ['manageOperators', 'Gerenciar operadores'],
  ['viewLogs', 'Ver logs'],
  ['exportBackups', 'Exportar backup'],
  ['viewPMs', 'Ver PMs'],
  ['viewSettings', 'Ver configurações'],
  ['editSettings', 'Editar configurações']
] as const;

function has(admin: Admin | null, key: string) {
  return !!admin?.isMaster || !!admin?.permissions?.[key];
}

async function logAction(action: string, details: any = {}) {
  const user = auth.currentUser;
  if (!user) return;
  await addDoc(collection(db, 'audit_logs'), {
    actorUid: user.uid,
    actorEmail: normalizeEmail(user.email),
    actorType: 'admin',
    action,
    details,
    createdAt: serverTimestamp()
  });
}

function LoginPage() {
  async function googleLogin() {
    await signInWithPopup(auth, new GoogleAuthProvider());
  }
  return (
    <div className="login-page">
      <div className="login-card">
        <section className="login-hero">
          <div className="brand-mark">ADM</div>
          <h1>Painel Administrativo</h1>
          <p>Acesso restrito por Google para administradores liberados.</p>
        </section>
        <section className="login-form">
          <h2>Entrar como ADM</h2>
          <button onClick={googleLogin} style={{ width: '100%' }}>Entrar com Google</button>
        </section>
      </div>
    </div>
  );
}

function Dashboard({ admin }: { admin: Admin }) {
  return (
    <section className="card">
      <h2>Administrador</h2>
      <p><strong>{admin.name}</strong> — {admin.email}</p>
      {admin.isMaster && <div className="notice success">Você é o ADM master do sistema.</div>}
      <div className="grid three">
        <div className="card"><h3>Projeto</h3><strong>Site PM</strong></div>
        <div className="card"><h3>Firebase</h3><strong>site-pm-guiasys</strong></div>
        <div className="card"><h3>Sites</h3><strong>3</strong></div>
      </div>
    </section>
  );
}

function OperatorsPage({ admin }: { admin: Admin }) {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function load() {
    const snap = await getDocs(collection(db, 'operational_users'));
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => { load(); }, []);

  async function save(item: any) {
    const email = normalizeEmail(item.email);
    const payload = {
      email,
      name: item.name || email,
      status: item.status || 'active',
      permissions: item.permissions || {},
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'operational_users', email), {
      ...payload,
      createdAt: item.createdAt || serverTimestamp()
    }, { merge: true });
    await logAction('operational_user_saved', { email });
    setEditing(null);
    load();
  }

  async function remove(email: string) {
    if (!confirm('Excluir operador?')) return;
    await deleteDoc(doc(db, 'operational_users', normalizeEmail(email)));
    await logAction('operational_user_deleted', { email });
    load();
  }

  return (
    <section className="card">
      <div className="topbar"><h2>Operadores</h2><button onClick={() => setEditing({ email: '', name: '', status: 'active', permissions: {} })}>Criar operador</button></div>
      <div className="table-wrap">
        <table><thead><tr><th>Nome</th><th>E-mail</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {items.map((i) => <tr key={i.email}><td>{i.name}</td><td>{i.email}</td><td><span className={`badge ${statusBadgeClass(i.status)}`}>{statusLabel(i.status)}</span></td><td className="actions"><button className="secondary" onClick={() => setEditing(i)}>Editar</button><button className="danger" onClick={() => remove(i.email)}>Excluir</button></td></tr>)}
        </tbody></table>
      </div>
      {editing && <UserModal title="Operador" item={editing} permissionList={OP_PERMISSIONS as any} onClose={() => setEditing(null)} onSave={save} />}
    </section>
  );
}

function AdminsPage({ admin }: { admin: Admin }) {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  async function load() {
    const snap = await getDocs(collection(db, 'admin_users'));
    setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }
  useEffect(() => { load(); }, []);

  async function save(item: any) {
    const email = normalizeEmail(item.email);
    await setDoc(doc(db, 'admin_users', email), {
      email,
      name: item.name || email,
      status: item.status || 'active',
      isMaster: item.isMaster || false,
      permissions: item.permissions || {},
      updatedAt: serverTimestamp(),
      createdAt: item.createdAt || serverTimestamp()
    }, { merge: true });
    await logAction('admin_user_saved', { email });
    setEditing(null);
    load();
  }

  async function remove(email: string) {
    if (!confirm('Excluir ADM?')) return;
    await deleteDoc(doc(db, 'admin_users', normalizeEmail(email)));
    await logAction('admin_user_deleted', { email });
    load();
  }

  return (
    <section className="card">
      <div className="topbar"><h2>Administradores</h2><button onClick={() => setEditing({ email: '', name: '', status: 'active', permissions: {} })}>Criar ADM</button></div>
      <div className="table-wrap">
        <table><thead><tr><th>Nome</th><th>E-mail</th><th>Master</th><th>Status</th><th>Ações</th></tr></thead><tbody>
          {items.map((i) => <tr key={i.email}><td>{i.name}</td><td>{i.email}</td><td>{i.isMaster ? 'Sim' : 'Não'}</td><td>{statusLabel(i.status)}</td><td className="actions"><button className="secondary" onClick={() => setEditing(i)}>Editar</button>{!i.isMaster && <button className="danger" onClick={() => remove(i.email)}>Excluir</button>}</td></tr>)}
        </tbody></table>
      </div>
      {editing && <UserModal title="Administrador" item={editing} permissionList={ADM_PERMISSIONS as any} onClose={() => setEditing(null)} onSave={save} />}
    </section>
  );
}

function UserModal({ title, item, permissionList, onClose, onSave }: { title: string; item: any; permissionList: readonly any[]; onClose: () => void; onSave: (item: any) => void }) {
  const [data, setData] = useState<any>({ ...item, permissions: item.permissions || {} });
  function toggle(key: string) {
    setData({ ...data, permissions: { ...data.permissions, [key]: !data.permissions?.[key] } });
  }

  function markAll(value: boolean) {
    const next: Record<string, boolean> = {};
    permissionList.forEach(([key]) => {
      next[key] = value;
    });
    setData({ ...data, permissions: next });
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="form-grid">
        <div className="grid two">
          <label>Nome
            <input value={data.name || ''} onChange={(e) => setData({ ...data, name: e.target.value })} />
          </label>
          <label>E-mail
            <input type="email" value={data.email || ''} onChange={(e) => setData({ ...data, email: e.target.value })} />
          </label>
        </div>
        <label>Status
          <select value={data.status || 'active'} onChange={(e) => setData({ ...data, status: e.target.value })}>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </label>
        <div className="topbar" style={{ marginBottom: 0 }}>
          <h3>Permissões</h3>
          <div className="actions">
            <button type="button" className="secondary" onClick={() => markAll(true)}>Marcar todas</button>
            <button type="button" className="ghost" onClick={() => markAll(false)}>Limpar</button>
          </div>
        </div>
        <div className="grid two">
          {permissionList.map(([key, label]) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={!!data.permissions?.[key]} onChange={() => toggle(key)} />
              {label}
            </label>
          ))}
        </div>
        <button onClick={() => onSave(data)}>Salvar</button>
      </div>
    </Modal>
  );
}

function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    getDocs(query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'))).then((snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);
  return (
    <section className="card">
      <h2>Logs de auditoria</h2>
      <div className="table-wrap"><table><thead><tr><th>Usuário</th><th>Ação</th><th>Detalhes</th></tr></thead><tbody>
        {logs.map((l) => <tr key={l.id}><td>{l.actorEmail}</td><td>{l.action}</td><td><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(l.details || {}, null, 2)}</pre></td></tr>)}
      </tbody></table></div>
    </section>
  );
}

function SettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  useEffect(() => {
    getDocs(collection(db, 'system_settings')).then((snap) => setSettings(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);
  return (
    <section className="card">
      <h2>Configurações dos sites</h2>
      <div className="table-wrap"><table><thead><tr><th>Site</th><th>Domínio</th><th>Status</th><th>Google</th><th>Email/Senha</th></tr></thead><tbody>
        {settings.map((s) => <tr key={s.id}><td>{s.siteName}</td><td>{s.domain}</td><td>{s.status}</td><td>{s.allowGoogleLogin ? 'Sim' : 'Não'}</td><td>{s.allowEmailPasswordLogin ? 'Sim' : 'Não'}</td></tr>)}
      </tbody></table></div>
    </section>
  );
}

function PMsAdminPage() {
  const [pms, setPms] = useState<any[]>([]);
  useEffect(() => {
    getDocs(collection(db, 'pm_profiles')).then((snap) => setPms(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);
  return (
    <section className="card">
      <h2>PMs</h2>
      <p>Área administrativa apenas para visualização. Aprovação, recusa e inativação de PM são funções exclusivas do Painel Operacional conforme permissões.</p>
      <div className="table-wrap"><table><thead><tr><th>Nome de guerra</th><th>Matrícula</th><th>Status</th></tr></thead><tbody>
        {pms.map((p) => <tr key={p.id}><td>{p.warName}</td><td>{p.registration}</td><td>{statusLabel(p.status)}</td></tr>)}
      </tbody></table></div>
    </section>
  );
}

function BackupsPage() {
  async function exportJson() {
    const collections = ['admin_users', 'operational_users', 'pm_profiles', 'missions', 'mission_lists', 'mission_participations', 'evaluation_criteria', 'pm_evaluations', 'messages', 'notifications', 'audit_logs', 'system_settings'];
    const data: any = {};
    for (const c of collections) {
      const snap = await getDocs(collection(db, c));
      data[c] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-site-pm-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await logAction('backup_exported_json');
  }
  return (
    <section className="card">
      <h2>Backup e exportação</h2>
      <p>Exportação inicial em JSON completo. CSV por coleção será refinado nos próximos módulos.</p>
      <button onClick={exportJson}>Exportar JSON completo</button>
    </section>
  );
}


function AccountPage({ admin, user }: { admin: Admin; user: User }) {
  const activePermissions = Object.entries(admin.permissions || {}).filter(([, value]) => value);
  return (
    <section className="card">
      <h2>Minha conta administrativa</h2>
      <div className="grid two">
        <div>
          <p><strong>Nome:</strong> {admin.name || '-'}</p>
          <p><strong>E-mail:</strong> {admin.email}</p>
          <p><strong>UID Firebase:</strong> {user.uid}</p>
          <p><strong>Status:</strong> <span className={`badge ${statusBadgeClass(admin.status)}`}>{statusLabel(admin.status)}</span></p>
          {admin.isMaster && <div className="notice success">Conta ADM master com acesso total.</div>}
        </div>
        <div>
          <h3>Permissões ativas</h3>
          {admin.isMaster ? (
            <p>ADM master: todas as permissões liberadas.</p>
          ) : activePermissions.length ? (
            <ul>{activePermissions.map(([key]) => <li key={key}>{key}</li>)}</ul>
          ) : (
            <p>Nenhuma permissão administrativa ativa.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<Admin | null | undefined>(undefined);
  const [page, setPage] = useState('dashboard');

  async function loadAdmin(current: User) {
    const email = normalizeEmail(current.email);
    const snap = await getDoc(doc(db, 'admin_users', email));
    if (snap.exists() && snap.data().status === 'active') setAdmin({ ...(snap.data() as Admin), email });
    else setAdmin(null);
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (current) => {
      setUser(current);
      if (current) await loadAdmin(current);
      else setAdmin(undefined);
    });
  }, []);

  if (!user) return <LoginPage />;
  if (admin === undefined) return <div className="login-page"><div className="card">Carregando...</div></div>;
  if (!admin) return <div className="login-page"><div className="card"><h2>Acesso não autorizado</h2><p>Esta conta Google não possui permissão administrativa.</p><button onClick={() => signOut(auth)}>Sair</button></div></div>;

  const nav = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'operators', label: 'Operadores', visible: has(admin, 'manageOperators') },
    { key: 'admins', label: 'Administradores', visible: has(admin, 'manageAdmins') },
    { key: 'pms', label: 'PMs', visible: has(admin, 'viewPMs') },
    { key: 'logs', label: 'Logs', visible: has(admin, 'viewLogs') },
    { key: 'settings', label: 'Configurações', visible: has(admin, 'viewSettings') || has(admin, 'editSettings') },
    { key: 'backups', label: 'Backup/Exportação', visible: has(admin, 'exportBackups') },
    { key: 'account', label: 'Minha conta' }
  ];

  return (
    <Shell title="Painel Administrativo" subtitle="adm.pm.guiasys.online" nav={nav} current={page} onNavigate={setPage} userLabel={admin.name || user.email || 'ADM'} onLogout={() => signOut(auth)}>
      {page === 'dashboard' && <Dashboard admin={admin} />}
      {page === 'operators' && <OperatorsPage admin={admin} />}
      {page === 'admins' && <AdminsPage admin={admin} />}
      {page === 'pms' && <PMsAdminPage />}
      {page === 'logs' && <LogsPage />}
      {page === 'settings' && <SettingsPage />}
      {page === 'backups' && <BackupsPage />}
      {page === 'account' && <AccountPage admin={admin} user={user} />}
    </Shell>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
