import { Router } from "express";
import authRouter from "./auth";
import coreRouter from "./core";
import attendanceRouter from "./attendance";
import marksRouter from "./marks";
import progressRouter from "./progress";
import analyticsRouter from "./analytics";
import leaveRouter from "./leave";
import dashboardRouter from "./dashboard";
import exportsRouter from "./exports";
import dataRouter from "./data";

const router = Router();

router.use("/auth", authRouter);
router.use("/", coreRouter);
router.use("/attendance", attendanceRouter);
router.use("/marks", marksRouter);
router.use("/progress", progressRouter);
router.use("/analytics", analyticsRouter);
router.use("/leave", leaveRouter);
router.use("/dashboard", dashboardRouter);
router.use("/exports", exportsRouter);
router.use("/data", dataRouter);

export default router;
