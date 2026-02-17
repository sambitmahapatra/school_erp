import { useState } from "react";
import { apiPost } from "../api/client";

export default function LoginPage({ onLogin }: { onLogin?: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await apiPost<{ data: { token: string } }>("/auth/login", { email, password });
      onLogin?.(res.data.token);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-panel__brand">School ERP</div>
        <div className="login-panel__title">Academic operations, without the paperwork.</div>
        <div className="login-panel__subtitle">
          A secure internal system built for teachers and academic staff. Fast data entry, clean analytics, and
          transparent audit trails.
        </div>
        <div className="callout">
          Sign in to view real-time academic data, attendance, and marks. No public access.
        </div>
      </div>

      <div className="login-card">
        <div className="login-title">Sign in</div>
        <div className="login-subtitle">Teacher workspace login</div>
        <label className="form-label">Email</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@school.edu" />
        <label className="form-label">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
        {error ? <div className="callout callout--warning">{error}</div> : null}
        <button className="btn btn--primary" type="button" onClick={handleSubmit} disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <div className="login-helper">Need access? Contact the academic coordinator.</div>
      </div>
    </div>
  );
}
