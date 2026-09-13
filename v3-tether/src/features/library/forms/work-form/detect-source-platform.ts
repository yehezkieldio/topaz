interface SourcePlatformOption {
  id: string;
  name: string;
  baseUrl: string | null;
}

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname.replace(/^www\./u, "").toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Matches a pasted/typed story URL's hostname against each source
 * platform's baseUrl to auto-select the right "Source platform" dropdown
 * entry -- e.g. an archiveofourown.org link selects "AO3" without the admin
 * having to do it by hand.
 */
export const detectSourcePlatform = (
  url: string,
  sourcePlatforms: SourcePlatformOption[]
): string | null => {
  const host = hostOf(url);
  if (!host) {
    return null;
  }
  const match = sourcePlatforms.find((platform) => {
    const platformHost = platform.baseUrl ? hostOf(platform.baseUrl) : null;
    return platformHost !== null && host.endsWith(platformHost);
  });
  return match?.id ?? null;
};
