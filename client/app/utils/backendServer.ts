export function getServerBackendUrl(): string {
  return (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL_LIVE || "").replace(/\/+$/, "");
}

export function getForwardedClientHeaders(req: Request): Record<string, string> {
  const forwardedFor = req.headers.get("x-forwarded-for") || "";
  const clientIp = forwardedFor.split(",").map((value) => value.trim()).filter(Boolean).pop() || req.headers.get("x-real-ip") || "";
  return clientIp ? { "X-Forwarded-For": clientIp } : {};
}
