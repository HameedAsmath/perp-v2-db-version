import type { UserAccount } from "../state/users";
import type { Position } from "../state/positions";
import type { RestingOrder } from "types";

export const SNAPSHOT_VERSION = 1;

export type EngineSnapshot = {
  version: number;
  createdAt: string;
  users: Record<string, UserAccount>;
  positions: Record<string, Record<string, Position>>; // userId → symbol → position
  orderbook: Record<string, { bids: RestingOrder[]; asks: RestingOrder[] }>;
};
