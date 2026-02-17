import { useEffect, useState } from "react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import DataTable from "../components/DataTable";
import StatTile from "../components/StatTile";
import StatusPill from "../components/StatusPill";
import { API_BASE, apiGet, apiPost } from "../api/client";

type LeaveType = { id: number; name: string; default_balance: number };
type LeaveBalance = { name: string; balance: number };
type LeaveCalendarRow = { id: number; teacher_id: number; first_name: string; last_name: string; start_date: string; end_date: string; status: string };

export default function LeavePage() {
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [calendar, setCalendar] = useState<LeaveCalendarRow[]>([]);
  const [leaveTypeId, setLeaveTypeId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const month = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    apiGet<{ data: LeaveType[] }>("/leave/types").then((res) => {
      setTypes(res.data);
      if (res.data.length) setLeaveTypeId(res.data[0].id);
    });
    apiGet<{ data: LeaveBalance[] }>("/leave/balances").then((res) => setBalances(res.data));
    apiGet<{ data: LeaveCalendarRow[] }>(`/leave/calendar?month=${month}`).then((res) => setCalendar(res.data));
  }, []);

  const handleSubmit = async () => {
    if (!leaveTypeId || !startDate || !endDate) return;
    await apiPost("/leave/requests", { leaveTypeId, startDate, endDate, reason });
  };

  const handleExport = async () => {
    const token = localStorage.getItem("erp-token");
    const url = `${API_BASE}/exports/leave?month=${month}`;
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = "leave.csv";
    link.click();
  };

  return (
    <div className="page">
      <PageHeader
        title="Leave Management"
        subtitle="Request, track, and approve leave"
        actions={
          <div className="header-actions">
            <button className="btn btn--ghost" onClick={handleExport}>
              Export CSV
            </button>
            <button className="btn btn--primary">New Request</button>
          </div>
        }
      />

      <div className="grid grid--tiles">
        {balances.map((b) => (
          <StatTile key={b.name} label={b.name} value={String(b.balance)} meta="Balance" />
        ))}
        {!balances.length ? <StatTile label="Leave balance" value="0" meta="No data" /> : null}
      </div>

      <div className="grid grid--two">
        <Card title="New Request" subtitle="Submit a new leave request">
          <div className="form-grid">
            <div>
              <label className="form-label">Type</label>
              <select className="input" value={leaveTypeId ?? ""} onChange={(e) => setLeaveTypeId(Number(e.target.value))}>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Start</label>
              <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">End</label>
              <input className="input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">Reason</label>
              <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="inline-actions">
            <button className="btn btn--primary" onClick={handleSubmit}>
              Submit
            </button>
          </div>
        </Card>

        <Card title="Leave Calendar" subtitle="Upcoming leave across staff">
          {calendar.length === 0 ? (
            <div className="callout">No leave requests for this month.</div>
          ) : (
            <DataTable
              headers={["Teacher", "Dates", "Status"]}
              rows={calendar.map((l) => [
                `${l.first_name} ${l.last_name}`,
                `${l.start_date} to ${l.end_date}`,
                <StatusPill key={l.id} label={l.status} tone={l.status === "approved" ? "success" : "warning"} />
              ])}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
