export type TouristSession = {
  accessToken: string;
};

const touristLinkPattern = /^\/tourist\/([^/]+)\/?$/;

/** Extracts the raw token from a secure tourist link without persisting it. */
export function extractTouristToken(pathname: string): string | null {
  const match = pathname.match(touristLinkPattern);
  return match?.[1] ?? null;
}

/** Keeps the active tourist token in memory only. */
export function createTouristSession(initialToken?: string | null) {
  let session: TouristSession | null = initialToken
    ? { accessToken: initialToken }
    : null;

  return {
    get(): TouristSession | null {
      return session;
    },
    set(accessToken: string): TouristSession {
      session = { accessToken };
      return session;
    },
    clear(): void {
      session = null;
    },
  };
}
