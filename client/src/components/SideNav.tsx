import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiGet } from "../api/client";

type Me = { id: number; email?: string; firstName?: string; lastName?: string };

const navItems = [
  { to: "/dashboard", label: "Today" },
  { to: "/attendance", label: "Attendance" },
  { to: "/marks", label: "Marks" },
  { to: "/analytics", label: "Analytics" },
  { to: "/leave", label: "Leave" },
  { to: "/data-admin", label: "Data Tools" },
  { to: "/settings", label: "Settings" }
];

export default function SideNav() {
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

  return (
    <aside className="side-nav">
      <div className="side-nav__logo">ERP</div>
      <div className="side-nav__profile">
        <div className="side-nav__avatar">{initials || "U"}</div>
        <div>
          <div className="side-nav__name">{name}</div>
          <div className="side-nav__role">Academic Staff</div>
        </div>
      </div>
      <div className="side-nav__section">Workspace</div>
      <nav className="side-nav__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              isActive ? "side-nav__link side-nav__link--active" : "side-nav__link"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="side-nav__footer">
        <div className="side-nav__status">
          <span className="status-pill status-pill--success">Online</span>
          <span className="side-nav__status-text">Local server</span>
        </div>
      </div>
    </aside>
  );
}
