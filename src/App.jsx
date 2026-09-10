import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSession, signOut } from './lib/auth';
import { generateDueOccurrences } from './lib/recurring';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import TaskDetail from './pages/TaskDetail';
import TaskList from './pages/TaskList';
import CreateTask from './pages/CreateTask';
import Notifications from './pages/Notifications';
import Users from './pages/Users';
import MonthlyClosing from './pages/MonthlyClosing';
import MonthlyClosingDetail from './pages/MonthlyClosingDetail';
import RecurringTasks from './pages/RecurringTasks';
import Reports from './pages/Reports';
import More from './pages/More';
import Profile from './pages/Profile';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';

export default function App() {
  const { authUser, profile, loading, isAdmin, isActive, passwordRecovery, clearPasswordRecovery } = useSession();

  if (loading || authUser === undefined) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  // Takes priority over everything else below, including profile/active
  // checks — someone mid-password-reset shouldn't be routed anywhere else
  // in the app until they've actually set a new password.
  if (passwordRecovery) {
    return <ResetPassword onDone={clearPasswordRecovery} />;
  }

  if (!authUser) {
    return <Login />;
  }

  if (!profile) {
    // Logged into Supabase Auth but no matching row in public.users yet —
    // an Admin needs to add them there (see README: "How to add users").
    return (
      <div className="app-page app-page--centered app-page--narrow" style={{ textAlign: 'center', minHeight: '100vh' }}>
        <div>
          <p style={{ fontSize: 14, marginBottom: 16 }}>Your account isn't set up yet. Ask your Admin to add you as a team member.</p>
          <button className="btn" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="app-page app-page--centered app-page--narrow" style={{ textAlign: 'center', minHeight: '100vh' }}>
        <div>
          <p style={{ fontSize: 14, marginBottom: 16 }}>Your account has been deactivated. Contact your Admin.</p>
          <button className="btn" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppShell profile={profile} isAdmin={isAdmin} />
    </BrowserRouter>
  );
}

function AppShell({ profile, isAdmin }) {
  useEffect(() => {
    // Interim client-triggered recurring-task generation — see src/lib/recurring.js
    // for why this isn't a true server-side schedule yet.
    if (isAdmin) generateDueOccurrences();
  }, [isAdmin]);

  return (
    <>
      <TopBar profile={profile} />
      <Routes>
        <Route path="/" element={isAdmin ? <AdminDashboard profile={profile} /> : <UserDashboard profile={profile} />} />
        <Route path="/tasks" element={<TaskList profile={profile} />} />
        <Route path="/task/:id" element={<TaskDetail profile={profile} />} />
        <Route path="/create" element={<CreateTask profile={profile} />} />
        <Route path="/notifications" element={<Notifications profile={profile} />} />
        <Route path="/assigned-by-me" element={<TaskList profile={profile} mode="created" />} />
        {isAdmin && <Route path="/users" element={<Users profile={profile} />} />}
        {isAdmin && <Route path="/recurring" element={<RecurringTasks profile={profile} />} />}
        {isAdmin && <Route path="/reports" element={<Reports profile={profile} />} />}
        {isAdmin && <Route path="/more" element={<More profile={profile} />} />}
        <Route path="/closing" element={<MonthlyClosing profile={profile} />} />
        <Route path="/closing/:id" element={<MonthlyClosingDetail profile={profile} />} />
        <Route path="/profile" element={<Profile profile={profile} />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <BottomNav isAdmin={isAdmin} />
    </>
  );
}
