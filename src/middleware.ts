import { defineMiddleware } from 'astro:middleware';

const extensionsToRemove = ['.html', '.htm'];

const removeHtmlExtension = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;
  const lowerPathname = pathname.toLowerCase();

  for (const ext of extensionsToRemove) {
    if (lowerPathname.endsWith(ext)) {
      const newPathname = pathname.slice(0, -ext.length);
      return context.rewrite(newPathname + context.url.search);
    }
  }

  return next();
});

export const onRequest = removeHtmlExtension;
