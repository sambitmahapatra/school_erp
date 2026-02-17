# API Design

Base URL: `/api/v1`

## Auth
- POST `/auth/login` -> login and issue session token
- POST `/auth/logout`
- GET `/auth/me` -> current user profile and scope

Auth uses `Authorization: Bearer <token>` for all protected routes.

## Core Data
- GET `/classes` -> classes in user scope
- GET `/subjects` -> subjects in user scope
- GET `/students?classId=` -> students in class
- GET `/assignments` -> teacher assignments

## Attendance
- GET `/attendance/sessions?date=&classId=&subjectId=`
- POST `/attendance/sessions` -> create draft session
- PATCH `/attendance/sessions/:id` -> update status (draft/submitted)
- POST `/attendance/entries/bulk` -> bulk upsert entries
- PATCH `/attendance/entries/:id` -> edit entry with reason
- GET `/attendance/analytics/class?classId=&month=`
- GET `/attendance/analytics/student/:studentId`

## Exams and Marks
- GET `/exams?yearId=`
- POST `/exams`
- GET `/exams/:id/components`
- POST `/exams/:id/components`
- POST `/marks/bulk` -> bulk marks entry
- GET `/marks?examId=&classId=&subjectId=`
- GET `/marks/analytics/class?classId=&examId=`
- GET `/marks/analytics/student/:studentId`

## Analytics
- GET `/analytics/class?classId=&examId=&subjectId=` -> class-wise analytics
- GET `/analytics/student?studentId=&startDate=&endDate=` -> student-wise analytics

## Notes
- POST `/progress/notes` -> teacher notes
- PATCH `/progress/notes/:id`

## Leave
- GET `/leave/types`
- GET `/leave/balances` -> teacher balances
- POST `/leave/requests`
- PATCH `/leave/requests/:id` -> approve or reject
- GET `/leave/calendar?month=`

## Dashboard
- GET `/dashboard/summary` -> tiles and status
- GET `/dashboard/alerts` -> low attendance, missing data
- GET `/dashboard/upcoming-exams`
- GET `/dashboard/class-analytics?classId=&month=` -> class performance analytics

## Exports
- GET `/exports/students` -> CSV
- GET `/exports/attendance` -> CSV
- GET `/exports/marks` -> CSV
- GET `/exports/leave` -> CSV

## Response Shapes (Standard)
- Success: `{ data, meta }`
- Error: `{ error: { code, message, details } }`
