import { Router, type IRouter } from "express";
import healthRouter from "./health";
import barcodeRouter from "./barcode";
import visionRouter from "./vision";
import recipesRouter from "./recipes";
import varyRouter from "./vary";
import authRouter from "./auth";
import partyPlannerRouter from "./partyPlanner";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(barcodeRouter);
router.use(visionRouter);
router.use(recipesRouter);
router.use(varyRouter);
router.use(partyPlannerRouter);

export default router;
