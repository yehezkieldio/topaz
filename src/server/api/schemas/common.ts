import { z } from "zod/v4";

export const publicIdSchema = z.string().min(1).max(50);
