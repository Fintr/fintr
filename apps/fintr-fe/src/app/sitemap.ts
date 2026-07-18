import type { MetadataRoute } from "next";

import {
  BLOG_ARTICLES,
  buildBlogArticleUrl,
  SITEMAP_MARKETING_ROUTES,
} from "@/lib/seo-config";
import { BLOG_SITE_URL, getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const buildTime = new Date();

  const marketingEntries: MetadataRoute.Sitemap = SITEMAP_MARKETING_ROUTES.map(
    (route) => ({
      url: `${siteUrl}${route.path}`,
      lastModified: buildTime,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    }),
  );

  const blogEntries: MetadataRoute.Sitemap = [
    {
      url: BLOG_SITE_URL,
      lastModified: buildTime,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...BLOG_ARTICLES.map((article) => ({
      url: buildBlogArticleUrl(article.slug),
      lastModified: new Date(article.lastModified),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  return [...marketingEntries, ...blogEntries];
}
