export function getApiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string" && data.trim()) {
    return data;
  }
  if (data && typeof data === "object") {
    const message = (data as { message?: unknown; error?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export function getApiErrorCode(error: unknown): string | undefined {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === "object") {
    const code = (data as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}
