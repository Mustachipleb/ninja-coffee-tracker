/**
 * Read a specific cookie value from a Cookie header.
 *
 * Some clients and proxies attach cookies with invalid percent-encoding.
 * We only inspect the requested cookie and treat decode failures as non-fatal.
 */
export function getCookieValue(
  cookieHeader: string | null,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;

    const separatorIndex = trimmedPart.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmedPart.slice(0, separatorIndex).trim();
    if (key !== name) continue;

    const rawValue = trimmedPart.slice(separatorIndex + 1);
    if (!rawValue) return "";

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}
