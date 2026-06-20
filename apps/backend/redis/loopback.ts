import type { EngineResponse, ToEngine } from "types";
import { producer } from "./client";

type Pending = {
  resolve: (value: EngineResponse) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
};

const pending = new Map<string, Pending>();

export function createPending(correlationId: string, entry: Pending) {
  pending.set(correlationId, entry);
}

export function completePending(correlationId: string, response: string) {
  const entry = pending.get(correlationId);
  if (!entry) {
    console.log("no entry found in pending", correlationId);
    return;
  }
  clearTimeout(entry.timer);
  pending.delete(correlationId);

  const parsed = JSON.parse(response) as EngineResponse;
  entry.resolve(parsed);
}

export function failPending(correlationId: string, error: Error) {
  const entry = pending.get(correlationId);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(correlationId);
  entry.reject(error);
}

function toStreamFields( // to convert everything to string for redis
  correlationId: string,
  message: ToEngine,
): Record<string, string> {
  const fields: Record<string, string> = {
    correlationId,
    messageType: message.messageType,
  };
  for (const [key, value] of Object.entries(message)) {
    if (key === "messageType") continue;
    fields[key] = String(value);
  }
  return fields;
}

export async function loopback(message: ToEngine, timeoutMs = 10_000) {
  const correlationId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      failPending(correlationId, new Error("timeout"));
    }, timeoutMs);
    createPending(correlationId, {
      resolve: (result) => {
        if (!result.ok) {
          reject(new Error(result.error ?? "Engine error"));
          return;
        }
        resolve(result.data);
      },
      reject,
      timer,
    });
    producer.xAdd("to-engine", "*", toStreamFields(correlationId, message));
  });
}
