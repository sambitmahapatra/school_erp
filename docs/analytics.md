# Analytics Logic Outline

## Attendance Completion Status (Dashboard)
- For each assigned class or subject, check attendance session for today.
- Status: complete if session is submitted.
- Pending list shows missing sessions or drafts.

## Class Attendance Trends
- Query attendance entries by class and date range.
- Calculate daily present percentage.
- Aggregate by week and month for trend lines.

## Student Attendance History
- Compute attendance percentage per month and overall.
- Flag chronic absenteeism if below threshold (configurable).

## Marks Analytics
- Class average per subject and exam.
- Student trend over time (percentage or grade).
- Distribution histogram by class.

## Attendance vs Marks Correlation
- For each student, compute attendance percentage and exam average.
- Generate scatter data for the selected term.

## Alerts
- Low attendance alert: attendance percentage < threshold.
- Missing marks alert: expected entries vs actual entries per class.
- Exams approaching alert based on schedule.

## KPI Tiles
- Attendance completion today
- Pending marks entries
- Average class performance
- Students flagged for attention
