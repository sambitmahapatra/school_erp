import { ReactNode } from "react";

export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <div className="page-header__title">{title}</div>
        {subtitle ? <div className="page-header__subtitle">{subtitle}</div> : null}
      </div>
      <div className="page-header__actions">{actions}</div>
    </div>
  );
}
