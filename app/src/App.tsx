import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';
import type { Anim } from './components/TaskList';
import { addDays, dayOffset, dueLabel, iso, today } from './lib/dates';
import { person } from './lib/people';
import { sortTasks } from './lib/sort';
import { setStorageUser } from './lib/storage';
import type { Meta, Mode, OwnerId, Review, Screen, Task, TaskPatch } from './lib/types';
import { useInbox } from './store/useInbox';
import { useSettings } from './store/useSettings';
import { useToast } from './store/useToast';
import { DetailScreen, type Decision, type Forward, type NewSubtask } from './screens/DetailScreen';
import { HomeScreen } from './screens/HomeScreen';
import { BoardScreen, type Bucket } from './screens/BoardScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { fetchMeta, hasApi } from './lib/api';
import { nameFor, ownerFor, roleFor } from './lib/auth';
import { DoneScreen } from './screens/DoneScreen';
import { FocusScreen } from './screens/FocusScreen';
import { ListScreen } from './screens/ListScreen';
import { PeopleScreen } from './screens/PeopleScreen';
import { QuickAddSheet, type NewTask } from './screens/QuickAddSheet';
import { ReviewScreen } from './screens/ReviewScreen';
import { SettingsSheet } from './screens/SettingsSheet';
import { GateScreen } from './screens/GateScreen';
import { readSession, writeSession, type Session } from './lib/auth';

type LastAction =
  | { type: 'complete'; id: string }
  | { type: 'snooze'; id: string; prev: TaskPatch }
  | { type: 'review'; id: string; prev: TaskPatch }
  | { type: 'add'; id: string };

/** Which tasks this person may see at all: managers everything, a team member only what is filed under their name. */
function visibleFor(tasks: Task[], role: 'carla' | 'barbara' | 'team', myOwner: OwnerId | null): Task[] {
  if (role !== 'team') return tasks;
  if (!myOwner) return [];
  return tasks.filter(t => t.owner === myOwner);
}

const isHandedOff = (t: Task) => t.review === 'Approved' || t.review === 'Barbara to handle';

function PhoneChrome() {
  return (
    <>
      <div className="phone-island" />
      <div className="phone-status" aria-hidden="true">
        <span>9:41</span>
        <span>
          <svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" fill="#000" /><rect x="4.8" y="5" width="3.2" height="7" rx="0.7" fill="#000" /><rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" fill="#000" /><rect x="14.4" y="0" width="3.2" height="12" rx="0.7" fill="#000" /></svg>
          <svg width="17" height="12" viewBox="0 0 17 12"><path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill="#000" /><path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill="#000" /><circle cx="8.5" cy="10.5" r="1.5" fill="#000" /></svg>
          <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke="#000" strokeOpacity="0.35" fill="none" /><rect x="2" y="2" width="20" height="9" rx="2" fill="#000" /><path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill="#000" fillOpacity="0.4" /></svg>
        </span>
      </div>
    </>
  );
}

/** Sign-in gate: the inbox (and its Notion connection) only mounts for a signed-in team member. */
export default function App() {
  const [session, setSession] = useState<Session | null>(() => { const s = readSession(); setStorageUser(s ? s.email : null); return s; });
  const signIn = (email: string, key: string) => { const s: Session = { email, at: Date.now(), key }; writeSession(s); setSession(s); };
  const signOut = () => { writeSession(null); setSession(null); };
  if (!session) {
    return (
      <div className="shell"><div className="phone"><PhoneChrome /><GateScreen onSignIn={signIn} /></div></div>
    );
  }
  return <InboxApp key={session.email} session={session} onSignOut={signOut} />;
}

function InboxApp({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const { settings, update: updateSettings } = useSettings();
  const { toast, show, hide } = useToast();
  const role = roleFor(session.email);
  const myOwner: OwnerId | null = role === 'carla' ? 'carla' : role === 'team' ? ownerFor(session.email) : null;
  const myName = nameFor(session.email);
  // The view follows the person, never the phone: Carla reviews, Barbara executes.
  const [mode, setModeState] = useState<Mode>(role === 'barbara' ? 'barbara' : 'carla');
  const inbox = useInbox(settings, 'carla', show);
  const { patch } = inbox;
  const tasks = useMemo(() => visibleFor(inbox.tasks, role, myOwner), [inbox.tasks, role, myOwner]);
  const [meta, setMeta] = useState<Meta | null>(null);
  useEffect(() => { if (hasApi) fetchMeta().then(setMeta).catch(() => undefined); }, []);

  const [screen, setScreen] = useState<Screen>('home');
  const [filter, setFilter] = useState<OwnerId | 'all'>(role === 'team' && myOwner ? myOwner : 'all');
  const [weekSel, setWeekSel] = useState(0);
  const [ownerId, setOwnerId] = useState<OwnerId>('carla');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState(0);
  const [focusOut, setFocusOut] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [anim, setAnim] = useState<Anim | null>(null);

  const lastAction = useRef<LastAction | null>(null);
  const animTimer = useRef<number>();
  const doneTimer = useRef<number>();
  const focusTimer = useRef<number>();
  useEffect(() => () => [animTimer, doneTimer, focusTimer].forEach(t => window.clearTimeout(t.current)), []);

  // Latest values for callbacks that run after a timeout.
  const latest = useRef({ tasks, mode, filter, screen, focusIdx });
  latest.current = { tasks, mode, filter, screen, focusIdx };

  const carla = mode === 'carla';
  const inMode = useCallback((t: Task, m: Mode = mode) => (m === 'carla' ? true : isHandedOff(t)), [mode]);
  const openOf = useCallback((ts: Task[], m: Mode) => ts.filter(t => !t.completed && inMode(t, m)), [inMode]);
  const open = openOf(tasks, mode);
  const pendingReview = tasks.filter(t => !t.completed && t.draft && (t.review === 'Pending review' || t.review === 'Changes requested'));
  const handoff = tasks.filter(t => !t.completed && isHandedOff(t));
  const reviewList = (carla ? pendingReview : handoff).slice().sort(sortTasks);
  const decided = carla ? handoff : [];
  const find = (id: string | null) => { const real = inbox.resolve(id); return tasks.find(t => t.id === id || t.id === real); };

  const focusQueueOf = useCallback((ts: Task[], m: Mode, f: OwnerId | 'all') => openOf(ts, m).filter(t => f === 'all' || t.owner === f).sort(sortTasks), [openOf]);
  const focusQueue = focusQueueOf(tasks, mode, filter);

  // ---- navigation
  const goTo = (s: Screen) => { setScreen(s); setDetailId(null); };
  const setMode = (m: Mode) => { setModeState(m); setFilter('all'); };
  const openDetail = (id: string) => { if (find(id)) setDetailId(id); else show(role === 'team' ? 'That task is not in your name' : 'That task is not open any more'); };

  // ---- actions
  const checkAllDone = () => {
    window.clearTimeout(doneTimer.current);
    doneTimer.current = window.setTimeout(() => {
      const l = latest.current;
      if (l.screen !== 'today' && l.screen !== 'focus') return;
      if (openOf(l.tasks, l.mode).length === 0) { setScreen('done'); hide(); }
    }, 650);
  };

  const complete = (id: string) => {
    const t = find(id); if (!t) return;
    if (t.completed) { patch(id, { completed: false }); show('Reopened'); return; }
    window.clearTimeout(animTimer.current);
    setAnim({ id, type: 'complete' });
    animTimer.current = window.setTimeout(() => {
      lastAction.current = { type: 'complete', id };
      setAnim(null);
      patch(id, { completed: true });
      show('Completed', true);
      checkAllDone();
    }, 560);
  };

  const snooze = (id: string | null, to: number | 'later', label: string, immediate = false) => {
    const t = find(id); if (!t) return;
    const p: TaskPatch = to === 'later' ? { due: iso(today()), time: '17:30' } : { due: iso(addDays(to)), time: null };
    const apply = () => {
      lastAction.current = { type: 'snooze', id: t.id, prev: { due: t.due, time: t.time ?? null } };
      setAnim(null);
      patch(t.id, p);
      show(label, true);
    };
    if (immediate) { apply(); return; }
    window.clearTimeout(animTimer.current);
    setAnim({ id: t.id, type: 'snooze' });
    animTimer.current = window.setTimeout(apply, 300);
  };

  const undo = () => {
    const a = lastAction.current; if (!a) return;
    lastAction.current = null;
    window.clearTimeout(doneTimer.current);
    if (a.type === 'complete') patch(a.id, { completed: false });
    if (a.type === 'snooze' || a.type === 'review') patch(a.id, a.prev);
    if (a.type === 'add') inbox.remove(a.id);
    hide();
    if (screen === 'done') setScreen('today');
  };

  const setReview = (id: string, review: Review, feedback?: string) => {
    const t = find(id); if (!t) return;
    lastAction.current = { type: 'review', id, prev: { review: t.review, feedback: t.feedback } };
    const p: TaskPatch = { review };
    if (feedback !== undefined) p.feedback = feedback;
    patch(id, p);
    const msgs: Partial<Record<Review, string>> = { 'Approved': 'Approved — Barbara will send it', 'Changes requested': 'Sent back to LOLI', 'Barbara to handle': 'Handed to Barbara' };
    show(msgs[review] || 'Updated', true);
  };

  const completeNow = (id: string) => {
    lastAction.current = { type: 'complete', id };
    patch(id, { completed: true });
    show('Completed', true);
  };

  const reorder = (gkey: string, from: number, to: number) => {
    let rows: Task[] = [];
    if (screen === 'today') rows = open.filter(t => t.owner === gkey).sort(sortTasks);
    else if (screen === 'week') rows = open.filter(t => dayOffset(t) === weekSel).sort(sortTasks);
    else rows = open.filter(t => t.owner === ownerId).sort(sortTasks);
    const ids = rows.map(t => t.id);
    const [m] = ids.splice(from, 1); ids.splice(to, 0, m);
    const ranks: Record<string, number> = {};
    ids.forEach((id, k) => { ranks[id] = k; });
    inbox.rank(ranks);
  };

  // ---- decisions (Carla / Barbara) and forwarding
  const say = (id: string, text: string) => { if (hasApi) inbox.comment(id, text, myName); };
  const whoResolved: 'Carla' | 'Barbara' | undefined = role === 'carla' ? 'Carla' : role === 'barbara' ? 'Barbara' : undefined;
  const decide = (d: Decision) => {
    if (!detail) return;
    const id = detail.id;
    if (d.kind === 'approve') { setReview(id, 'Approved'); say(id, 'Approved ✅'); setDetailId(null); }
    if (d.kind === 'reject') { setReview(id, 'Changes requested', d.reason || ''); say(id, `Rejected ❌ — ${d.reason || ''}`); setDetailId(null); }
    if (d.kind === 'resolved') { lastAction.current = { type: 'complete', id }; patch(id, whoResolved ? { completed: true, resolvedBy: whoResolved } : { completed: true }); say(id, 'Done — I handled this myself.'); show('Marked as done by you', true); setDetailId(null); checkAllDone(); }
    if (d.kind === 'complete') { lastAction.current = { type: 'complete', id }; patch(id, whoResolved ? { completed: true, resolvedBy: whoResolved } : { completed: true }); say(id, 'Completed ✔'); show('Completed', true); setDetailId(null); checkAllDone(); }
    if (d.kind === 'reopen') { patch(id, { completed: false, resolvedBy: null }); show('Reopened'); }
  };
  const forward = (f: Forward) => {
    if (!detail) return;
    const to = person(f.owner);
    const p: TaskPatch = { owner: f.owner };
    if (role !== 'team' && f.priority !== detail.priority) p.priority = f.priority;
    if (f.due !== null) { p.due = iso(addDays(f.due)); p.time = null; }
    lastAction.current = { type: 'review', id: detail.id, prev: { owner: detail.owner, priority: detail.priority, due: detail.due, time: detail.time ?? null } };
    patch(detail.id, p);
    say(detail.id, `Forwarded to ${to.short}${f.priority ? ` · ${f.priority} priority` : ''}${f.due !== null ? ` · due ${dueLabel({ due: p.due ?? null, time: null })}` : ''}${f.note ? ` — ${f.note}` : ''}`);
    show(`Forwarded to ${to.short}`, true);
    setDetailId(null);
  };

  const askCarla = (text: string) => {
    if (!detail) return;
    lastAction.current = { type: 'review', id: detail.id, prev: { teamReview: detail.teamReview ?? null, reviewRequest: detail.reviewRequest ?? null, requestedBy: detail.requestedBy ?? null, reviewReply: detail.reviewReply ?? null } };
    patch(detail.id, { teamReview: 'Requested', reviewRequest: text, requestedBy: myName, reviewReply: null });
    say(detail.id, `Asked Carla to confirm: ${text}`);
    show('Sent to Carla', true); setDetailId(null);
  };
  const answerRequest = (approved: boolean, reply: string) => {
    if (!detail) return;
    lastAction.current = { type: 'review', id: detail.id, prev: { teamReview: detail.teamReview ?? null, reviewReply: detail.reviewReply ?? null } };
    patch(detail.id, { teamReview: approved ? 'Approved' : 'Rejected', reviewReply: reply || (approved ? 'Approved' : '') });
    say(detail.id, approved ? `${myName} approved ✅${reply ? ' — ' + reply : ''}` : `${myName} said no ❌ — ${reply}`);
    show(approved ? 'Approved' : 'Answer sent', true); setDetailId(null);
  };
  const addSubtask = (sub: NewSubtask) => {
    if (!detail) return;
    const id = 'local-' + Date.now();
    const task: Task = {
      id, action: sub.title, subject: sub.title, from: myName, owner: sub.owner, priority: detail.priority, category: detail.category,
      review: null, draft: null, summary: '', due: sub.due === null ? null : iso(addDays(sub.due)), time: null, completed: false, feedback: null, gmail: null,
      project: detail.project ?? null, parentId: detail.id, ownerName: sub.ownerName,
    };
    lastAction.current = { type: 'add', id };
    inbox.create(task, { ownerName: sub.ownerName, from: myName });
    show(`Subtask added${sub.ownerName ? ` for ${sub.ownerName}` : ''}`, true);
  };

  // ---- detail
  const detail = find(detailId);

  // ---- focus
  const startFocus = () => {
    if (!focusQueue.length) { show('Nothing open'); return; }
    setScreen('focus'); setFocusIdx(0); setFocusOut(false); setDetailId(null); setSheetOpen(false);
  };
  const focusStep = (fn: (t: Task) => void) => {
    const t = focusQueue[Math.min(focusIdx, focusQueue.length - 1)]; if (!t) return;
    window.clearTimeout(focusTimer.current);
    setFocusOut(true);
    focusTimer.current = window.setTimeout(() => fn(t), 240);
  };
  const afterFocusChange = (done: boolean) => {
    window.setTimeout(() => {
      const l = latest.current;
      const left = focusQueueOf(l.tasks, l.mode, l.filter);
      if (done && !left.length) { setScreen('done'); return; }
      setFocusIdx(Math.min(l.focusIdx, Math.max(0, left.length - 1)));
    }, 30);
  };
  const focusDone = () => focusStep(t => {
    lastAction.current = { type: 'complete', id: t.id };
    setFocusOut(false); patch(t.id, { completed: true });
    afterFocusChange(true);
  });
  const focusLater = () => focusStep(t => {
    lastAction.current = { type: 'snooze', id: t.id, prev: { due: t.due, time: t.time ?? null } };
    setFocusOut(false); patch(t.id, { due: iso(addDays(1)), time: null }); show('Moved to tomorrow', true);
    afterFocusChange(false);
  });
  const focusSkip = () => {
    const n = focusQueue.length; if (n < 2) return;
    focusStep(() => { setFocusIdx(i => (i + 1) % n); setFocusOut(false); });
  };

  // ---- quick add
  const addTask = (d: NewTask) => {
    const id = 'local-' + Date.now();
    const task: Task = {
      id, action: d.title, subject: d.title, from: myName, owner: d.owner, priority: d.priority,
      category: 'Action required', review: null, draft: null, summary: '', due: d.due === null ? null : iso(addDays(d.due)),
      time: d.time, completed: false, feedback: null, gmail: null,
    };
    lastAction.current = { type: 'add', id };
    inbox.create(task, { from: myName });
    setSheetOpen(false);
    show(`Added · ${dueLabel(task)}`, true);
  };

  const isList = screen === 'today' || screen === 'week' || screen === 'owner';
  const showTabs = (isList || screen === 'home' || screen === 'board' || screen === 'calendar' || screen === 'people' || screen === 'review') && !detailId;
  const moveTo = (id: string, to: Bucket) => {
    const t = find(id); if (!t) return;
    lastAction.current = { type: 'snooze', id, prev: { due: t.due, time: t.time ?? null } };
    const due = to === 'none' ? null : to === 'today' ? iso(today()) : to === 'tomorrow' ? iso(addDays(1)) : iso(addDays(7));
    patch(id, { due, time: null });
    show(to === 'none' ? 'Date removed' : `Moved to ${to === 'later' ? 'next week' : to}`, true);
  };
  const fi = Math.min(focusIdx, Math.max(0, focusQueue.length - 1));
  const completedCount = tasks.filter(t => t.completed).length;
  const projects = Array.from(new Set([...(meta?.projects || []), ...tasks.map(t => t.project)].filter((p): p is string => !!p && p !== 'Sem projeto'))).sort();
  const teamOnly = role === 'team';
  /** A team member whose address is not on the roster owns nothing and cannot add anything either. */
  const canAdd = !teamOnly || !!myOwner;
  const connectionError = inbox.connection.status === 'error' ? inbox.connection.message || 'Could not reach the Smart Inbox.' : null;

  return (
    <div className="shell">
      <div className="phone">
        <PhoneChrome />

        {screen === 'home' && (
          <HomeScreen role={role} name={myName} myOwner={myOwner} tasks={tasks} loading={inbox.loading} error={connectionError} onRetry={() => { inbox.reload(); show('Reloading…'); }} pendingCount={inbox.pending.length} onOpen={openDetail} onSeeAll={teamOnly ? null : () => { setFilter('all'); goTo('today'); }} onSettings={() => setSettingsOpen(true)} />
        )}
        {screen === 'board' && <BoardScreen role={role} myOwner={myOwner} tasks={tasks} onMove={moveTo} onOpen={openDetail} onSettings={() => setSettingsOpen(true)} />}
        {screen === 'calendar' && <CalendarScreen role={role} myOwner={myOwner} tasks={tasks} onOpen={openDetail} onSettings={() => setSettingsOpen(true)} />}
        {isList && (
          <ListScreen
            screen={screen as 'today' | 'week' | 'owner'} mode={mode} headerAura={settings.headerAura} loading={inbox.loading}
            tasks={tasks} open={open} filter={filter} weekSel={weekSel} ownerId={ownerId}
            pendingCount={inbox.pending.length} pendingLabel="waiting to sync" connectionError={inbox.connection.status === 'error' ? inbox.connection.message : undefined} pendingReviewCount={pendingReview.length} anim={anim}
            showPeople={role !== 'team'} onMode={setMode} onFilter={setFilter} onWeekSel={setWeekSel} onFocus={startFocus}
            onSettings={() => setSettingsOpen(true)} onPeople={() => goTo('people')}
            onComplete={complete} onSnooze={id => snooze(id, 1, 'Moved to tomorrow')} onOpen={openDetail} onReorder={reorder}
            onAdd={() => { if (canAdd) setSheetOpen(true); else show('Ask Barbara to add you to the roster first'); }}
          />
        )}
        {screen === 'review' && (
          <ReviewScreen
            mode={mode} cards={reviewList} decided={decided}
            onApprove={id => setReview(id, 'Approved')}
            onChanges={(id, fb) => setReview(id, 'Changes requested', fb)}
            onBarbara={(id, fb) => setReview(id, 'Barbara to handle', fb)}
            onSaveDraft={(id, draft) => { patch(id, { draft }); show('Draft saved'); }}
            onComplete={completeNow} onOpen={openDetail} onSettings={() => setSettingsOpen(true)} notify={show}
          />
        )}
        {screen === 'people' && (
          <PeopleScreen tasks={tasks} openCount={open.length} onOpenOwner={id => { setOwnerId(id); goTo('owner'); }} onSettings={() => setSettingsOpen(true)} />
        )}

        {showTabs && <TabBar screen={screen} mode={mode} role={role} reviewCount={reviewList.length} onGo={goTo} onAdd={canAdd ? () => setSheetOpen(true) : null} />}

        {detail && (
          <DetailScreen
            key={detail.id} task={detail} all={tasks} role={role} me={myName} myOwner={myOwner} projects={projects} onClose={() => setDetailId(null)} onOpen={openDetail}
            onPatch={p => patch(detail.id, p)} onAskCarla={askCarla} onAnswerRequest={answerRequest} onAddSubtask={addSubtask}
            onSnooze={to => snooze(detail.id, to, to === 'later' ? 'Moved to later today' : to === 1 ? 'Moved to tomorrow' : 'Moved to next week', true)}
            onDecide={decide} onForward={forward} notify={show}
          />
        )}
        {screen === 'focus' && (
          <FocusScreen task={focusQueue[fi]} index={fi} total={focusQueue.length} out={focusOut}
            onExit={() => setScreen('today')} onDone={focusDone} onLater={focusLater} onSkip={focusSkip} />
        )}
        {screen === 'done' && (
          <DoneScreen summary={`${completedCount} items completed · ${pendingReview.length} drafts still to review.`} onReview={() => goTo('review')} onToday={() => goTo('today')} />
        )}

        {sheetOpen && canAdd && <QuickAddSheet mode={mode} fixedOwner={teamOnly ? myOwner : null} defaultDue={screen === 'week' ? weekSel : null} onAdd={addTask} onClose={() => setSheetOpen(false)} />}
        {settingsOpen && (
          <SettingsSheet settings={settings} source={inbox.source} connection={inbox.connection} pendingCount={inbox.pending.length} onUpdate={updateSettings}
            email={session.email} onSignOut={() => { setSettingsOpen(false); onSignOut(); }}
            onFlush={() => { inbox.flush(true); }} onReload={() => { inbox.reload(); show('Reloading…'); }} onClose={() => setSettingsOpen(false)} />
        )}

        <Toast toast={toast} onUndo={undo} />
      </div>
    </div>
  );
}
