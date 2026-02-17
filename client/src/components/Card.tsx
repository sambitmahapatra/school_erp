import { ReactNode } from "react";

type CardProps = {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  tone?: "default" | "soft" | "outline";
  children: ReactNode;
};

export default function Card({ title, subtitle, actions, tone = "default", children }: CardProps) {
  const toneClass = tone === "soft" ? "card--soft" : tone === "outline" ? "card--outline" : "";

  return (
    <div className={`card ${toneClass}`.trim()}>
      {title || subtitle || actions ? (
        <div className="card__header">
          <div>
            {title ? <div className="card__title">{title}</div> : null}
            {subtitle ? <div className="card__subtitle">{subtitle}</div> : null}
          </div>
          {actions ? <div className="card__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="card__body">{children}</div>
    </div>
  );
}
