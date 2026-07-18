const DEFAULT_SITE_URL = "https://fintr.ai";

export const getSiteUrl = (): string => {
  const raw = process.env.NEXT_PUBLIC_APP_BASE_URL ?? DEFAULT_SITE_URL;

  return raw.replace(/\/$/, "");
};

export const BLOG_SITE_URL = "https://blog.fintr.ai";
