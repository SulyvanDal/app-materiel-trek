import {Router} from "express";
import healthRouter from "./health.routes.ts";
import routerItem from "./item.routes.ts";

const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/items", routerItem);

export default apiRouter;