import { WebSocket } from "ws";

const subscribers = new Map<string, Set<WebSocket>>(); // which ws connection is watching which symbol

export function subscribe(symbol: string, ws: WebSocket) {
  if (!subscribers.has(symbol)) subscribers.set(symbol, new Set());
  subscribers.get(symbol)!.add(ws);
}

export function unsubscribe(symbol: string, ws: WebSocket) {
  subscribers.get(symbol)?.delete(ws);
}

export function broadcast(symbol: string, payload: string) {
  const clients = subscribers.get(symbol);
  if (!clients) return;
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}
