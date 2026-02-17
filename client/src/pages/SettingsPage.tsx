import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import { API_BASE } from "../api/client";

export default function SettingsPage() {
  const handleExportStudents = async () => {
    const token = localStorage.getItem("erp-token");
    const res = await fetch(`${API_BASE}/exports/students`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "students.csv";
    link.click();
  };

  return (
    <div className="page">
      <PageHeader title="Settings" subtitle="Profile and workspace preferences" />

      <div className="grid grid--two">
        <Card title="Profile" subtitle="Update your identity and contact">
          <div className="form-grid">
            <div>
              <label className="form-label">First name</label>
              <input className="input" />
            </div>
            <div>
              <label className="form-label">Last name</label>
              <input className="input" />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input className="input" />
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input className="input" />
            </div>
          </div>
          <div className="inline-actions">
            <button className="btn btn--primary">Save</button>
          </div>
        </Card>

        <Card title="Preferences" subtitle="Defaults and system behavior">
          <div className="form-grid">
            <div>
              <label className="form-label">Default class</label>
              <select className="input">
                <option value="">Select</option>
              </select>
            </div>
            <div>
              <label className="form-label">Theme</label>
              <select className="input">
                <option>Light</option>
                <option>Dark</option>
              </select>
            </div>
            <div>
              <label className="form-label">Autosave interval</label>
              <select className="input">
                <option>Every 30 seconds</option>
                <option>Every 60 seconds</option>
              </select>
            </div>
            <div>
              <label className="form-label">Notifications</label>
              <select className="input">
                <option>Only critical</option>
                <option>All updates</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid--two">
        <Card title="Keyboard Shortcuts" subtitle="Speed up daily actions">
          <div className="shortcut-list">
            <div className="shortcut-row">
              <span>Save draft</span>
              <span className="kbd">Ctrl</span>
              <span className="kbd">S</span>
            </div>
            <div className="shortcut-row">
              <span>Submit form</span>
              <span className="kbd">Ctrl</span>
              <span className="kbd">Enter</span>
            </div>
            <div className="shortcut-row">
              <span>Open search</span>
              <span className="kbd">Ctrl</span>
              <span className="kbd">K</span>
            </div>
          </div>
        </Card>
        <Card title="Data & Exports" subtitle="Download and audit options">
          <div className="form-grid">
            <div>
              <label className="form-label">Export format</label>
              <select className="input">
                <option>CSV</option>
              </select>
            </div>
            <div>
              <label className="form-label">Audit log retention</label>
              <select className="input">
                <option>1 year</option>
                <option>2 years</option>
              </select>
            </div>
          </div>
          <div className="inline-actions">
            <button className="btn btn--ghost" onClick={handleExportStudents}>
              Export Student Roster
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
