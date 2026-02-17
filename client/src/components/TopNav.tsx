import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api/client";

type Me = { id: number; email?: string; firstName?: string; lastName?: string };

type TopNavProps = {
  onLogout?: () => void;
};

export default function TopNav({ onLogout }: TopNavProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    apiGet<{ data: { user: Me } }>("/auth/me").then((res) => setMe(res.data.user)).catch(() => setMe(null));
  }, []);

  const name = me?.firstName ? `${me.firstName} ${me.lastName || ""}`.trim() : me?.email || "Signed in";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    try {
      await apiPost("/auth/logout");
    } catch (err) {
      // Ignore logout failures; local token removal still ends the session.
    }
    onLogout?.();
  };

  return (
    <div className="top-nav">
      <div className="top-nav__brand">
        <div className="top-nav__title">School ERP</div>
        <div className="top-nav__subtitle">Academic Workspace</div>
      </div>
      <div className="top-nav__meta">
        <span className="pill">{today}</span>
        <span className="pill pill--accent">Active Term</span>
        <div className="top-nav__user">
          <div className="top-nav__avatar">{initials || "U"}</div>
          <div>
            <div className="top-nav__name">{name}</div>
            <div className="top-nav__role">Local workspace</div>
          </div>
        </div>
        <button className="btn btn--ghost btn--sm" type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
