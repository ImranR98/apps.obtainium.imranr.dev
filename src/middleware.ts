import { defineMiddleware } from 'astro:middleware';

const extensionsToRemove = ['.html', '.htm'];

const removeHtmlExtension = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  const lowerPathname = pathname.toLowerCase();

  // Check if pathname ends with any of the extensions to remove
  for (const ext of extensionsToRemove) {
    if (lowerPathname.endsWith(ext)) {
      // Remove the extension (preserving original case)
      const newPathname = pathname.slice(0, -ext.length);
      // Preserve query string and hash
      const newUrl = new URL(newPathname + url.search + url.hash, url.origin);
      // Return a redirect response (301 permanent)
      return new Response(null, {
        status: 301,
        headers: {
          'Location': newUrl.toString(),
        },
      });
    }
  }

  // If no matching extension, proceed normally
  return next();
});

export const onRequest = removeHtmlExtension;
