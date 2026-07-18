import type { MetadataRoute } from "next";

import { BLOG_SITE_URL } from "@/lib/site-url";

type SitemapRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

export const ROBOTS_DISALLOW_PATHS = [
  "/admin/",
  "/crm/",
  "/dashboard/",
  "/discover/",
  "/onboarding/",
  "/sentry-example-page/",
  "/space-test/",
];

export const SITEMAP_MARKETING_ROUTES: SitemapRoute[] = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/pricing",
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    path: "/contact-us",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/privacy-policy",
    changeFrequency: "yearly",
    priority: 0.4,
  },
  {
    path: "/terms-of-service",
    changeFrequency: "yearly",
    priority: 0.4,
  },
  {
    path: "/delete-account",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/whats-next",
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: "/waitlist",
    changeFrequency: "monthly",
    priority: 0.5,
  },
  {
    path: "/auth",
    changeFrequency: "monthly",
    priority: 0.5,
  },
];

export type BlogArticle = {
  slug: string;
  lastModified: string;
};

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "multi-currency-done-right-how-fintr-handles-exchange-rates-and-why-it-matters",
    lastModified: "2026-07-18",
  },
];

export const buildBlogArticleUrl = (slug: string): string => {
  return `${BLOG_SITE_URL}/${slug}`;
};
