import { ReactNode } from "react";

type DataTableProps = {
  headers: string[];
  rows: ReactNode[][];
  compact?: boolean;
  className?: string;
};

export default function DataTable({ headers, rows, compact, className }: DataTableProps) {
  const classes = ["data-table", compact ? "data-table--compact" : "", className || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <table className={classes}>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx}>
            {row.map((cell, cellIdx) => (
              <td key={cellIdx}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
