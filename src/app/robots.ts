import type { MetadataRoute } from 'next';

/**
 * The PIN gate keeps a stranger out; it doesn't stop a crawler from finding
 * and indexing /unlock itself, which returns 200 and is prerendered — there
 * was no robots.txt at all before this. See docs/07-PRODUCTION-REVIEW.md #23.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', disallow: '/' },
  };
}
