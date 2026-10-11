import { Response } from "express";

export type SSEChannel = "admin" | "staff";

interface SSEConnection {
  response: Response;
  channel: SSEChannel;
}

const connections = new Set<SSEConnection>();

const HEARTBEAT_MS = 25000;

export function initSSE(response: Response, channel: SSEChannel) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  response.write(`: connected to ${channel} notification stream\n\n`);

  const connection: SSEConnection = { response, channel };
  connections.add(connection);

  const heartbeat = setInterval(() => {
    try {
      response.write(": ping\n\n");
    } catch (error) {
      clearInterval(heartbeat);
      connections.delete(connection);
    }
  }, HEARTBEAT_MS);

  response.on("close", () => {
    clearInterval(heartbeat);
    connections.delete(connection);
  });

  response.on("error", () => {
    clearInterval(heartbeat);
    connections.delete(connection);
  });
}

export function broadcastSSE(channel: SSEChannel, payload: Record<string, unknown>) {
  for (const connection of connections) {
    if (connection.channel !== channel) continue;
    try {
      connection.response.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      connections.delete(connection);
    }
  }
}