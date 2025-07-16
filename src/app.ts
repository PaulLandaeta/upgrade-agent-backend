import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import cors from 'cors';

import aiRoutes from "./routes/ai.routes";
import projectRoutes from "./routes/project.routes";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(multer({ dest: "uploads/" }).single("project"));

app.use("/api/project", projectRoutes);
app.use("/api/ai", aiRoutes);

export default app;
