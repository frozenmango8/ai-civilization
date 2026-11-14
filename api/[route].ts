import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handle } from "../server/http";
export default function handler(req: VercelRequest, res: VercelResponse) {
  return handle(req, res);
}
