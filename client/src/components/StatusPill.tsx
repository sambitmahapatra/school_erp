type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

type StatusPillProps = {
  label: string;
  tone?: StatusTone;
};

export default function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  return <span className={`status-pill status-pill--${tone}`}>{label}</span>;
}
