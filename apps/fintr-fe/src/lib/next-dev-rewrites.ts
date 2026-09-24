export type NextDevRewrite = {
  source: string;
  destination: string;
};

export const nextDevRewrites = (backendUrl: string): NextDevRewrite[] => {
  const normalized = backendUrl.replace(/\/$/, "");

  return [
    {
      source: "/api/v1/:path*",
      destination: `${normalized}/api/v1/:path*`,
    },
    {
      source: "/rails/active_storage/:path*",
      destination: `${normalized}/rails/active_storage/:path*`,
    },
  ];
};
