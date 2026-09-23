/**
 * Kirón Blogger connect.js scrapes the page shell and polls
 * /shell_import_pending every 5s. On localhost that request CORS-fails and,
 * when a Kirón editor session is present, the overlay remounts the homepage
 * so text ghosts and clicks never land.
 */
export function shouldLoadKironBlogger(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  explicitFlag: string | undefined = process.env.NEXT_PUBLIC_KIRON_BLOGGER,
): boolean {
  if (explicitFlag === "false") {
    return false;
  }

  if (explicitFlag === "true") {
    return true;
  }

  return nodeEnv === "production";
}
