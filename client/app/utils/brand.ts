import { systemInterface } from "@/app/types/system.type";

export const FALLBACK_LOGO = "/Florentina Inn Logo.png";
export const FALLBACK_HOTEL_NAME = "Florentina Inn";

export function resolveLogoUrl(logo?: string | null): string {
  const value = (logo || "").trim();
  return value ? value : FALLBACK_LOGO;
}

export function resolveHotelName(name?: string | null): string {
  const value = (name || "").trim();
  return value ? value : FALLBACK_HOTEL_NAME;
}

export interface BrandInfo {
  logoUrl: string;
  hotelName: string;
}

export function getBrand(systemInfo?: systemInterface | null): BrandInfo {
  return {
    logoUrl: resolveLogoUrl(systemInfo?.logo),
    hotelName: resolveHotelName(systemInfo?.systemName),
  };
}

const dataUrlCache = new Map<string, string>();

export async function getLogoDataUrl(url: string): Promise<string> {
  const source = resolveLogoUrl(url);

  const cached = dataUrlCache.get(source);
  if (cached) return cached;

  try {
    const response = await fetch(source, { mode: "cors" });
    if (!response.ok) return source;

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Failed to read logo"));
      reader.readAsDataURL(blob);
    });

    if (!dataUrl.startsWith("data:")) return source;

    dataUrlCache.set(source, dataUrl);
    return dataUrl;
  } catch {
    return source;
  }
}
