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
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
