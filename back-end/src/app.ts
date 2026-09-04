import express from "express"
import apiRouter from "./routes/index.ts"
import { errorHandler } from "./middlewares/error-handler.ts";

const app = express()

app.use(express.json())
app.use("/api", apiRouter)
app.use(errorHandler);

export default app;