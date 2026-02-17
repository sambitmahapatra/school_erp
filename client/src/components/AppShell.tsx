import { ReactNode } from "react";
import TopNav from "./TopNav";
import SideNav from "./SideNav";

type AppShellProps = {
  children: ReactNode;
  onLogout?: () => void;
};

export default function AppShell({ children, onLogout }: AppShellProps) {
  return (
    <div className="app-shell">
      <SideNav />
      <div className="app-main">
        <TopNav onLogout={onLogout} />
        <div className="app-content">{children}</div>
      </div>
    </div>
  );
}
