import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import DashboardPage from "./pages/DashboardPage";
import AttendancePage from "./pages/AttendancePage";
import MarksPage from "./pages/MarksPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import LeavePage from "./pages/LeavePage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import DataAdminPage from "./pages/DataAdminPage";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(Boolean(localStorage.getItem("erp-token")));
  }, []);

  const handleLogin = (token: string) => {
    localStorage.setItem("erp-token", token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("erp-token");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AppShell onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/marks" element={<MarksPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/progress" element={<Navigate to="/analytics" replace />} />
        <Route path="/leave" element={<LeavePage />} />
        <Route path="/data-admin" element={<DataAdminPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppShell>
  );
}
