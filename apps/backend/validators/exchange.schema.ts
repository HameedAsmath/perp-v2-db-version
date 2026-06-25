import { z } from "zod";

export const placeOrderSchema = z.object({
  userId: z.string().uuid(),
  symbol: z.string().min(1),
  side: z.enum(["long", "short"]),
  type: z.enum(["limit", "market"]),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().nonnegative(),
  leverage: z.coerce.number().int().positive().optional(),
  postOnly: z.boolean().optional(),
  slippage: z.coerce.number().min(0).max(100).int().positive().optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
