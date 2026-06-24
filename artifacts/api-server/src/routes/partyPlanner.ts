import { Router, type IRouter, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { logger } from "../lib/logger";
import { z } from "zod";

const router: IRouter = Router();

const BodySchema = z.object({
  prompt: z.string().min(1).max(30000),
  systemPrompt: z.string().max(5000).optional(),
});

// ─── POST /api/party-planner ──────────────────────────────────────────────────
router.post("/party-planner", async (req: Request, res: Response) => {
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { prompt, systemPrompt } = parsed.data;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt ?? "You are an expert party planner. Return only valid JSON with no markdown fences.",
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text : "";
    res.json({ text });
  } catch (err) {
    logger.error({ err }, "party-planner AI error");
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
