type StatTone = "default" | "accent" | "success" | "warning";

type StatTileProps = {
  label: string;
  value: string;
  meta?: string;
  trend?: string;
  tone?: StatTone;
};

export default function StatTile({ label, value, meta, trend, tone = "default" }: StatTileProps) {
  const toneClass = tone === "default" ? "" : `stat-tile--${tone}`;
  return (
    <div className={`stat-tile ${toneClass}`.trim()}>
      <div className="stat-tile__label">{label}</div>
      <div className="stat-tile__value">{value}</div>
      <div className="stat-tile__meta-row">
        {meta ? <div className="stat-tile__meta">{meta}</div> : null}
        {trend ? <div className="stat-tile__trend">{trend}</div> : null}
      </div>
    </div>
  );
}
