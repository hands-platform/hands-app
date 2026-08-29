/* eslint-disable @next/next/no-img-element -- Published CMS image hosts are validated content, not a build-time Next Image allowlist. */
import type { PublicSitePage } from '../lib/site-content';

type PublicSiteSectionData = PublicSitePage['sections'][number];

export function PublicSiteSection({ section }: { readonly section: PublicSiteSectionData }) {
  const { renderModel } = section;
  const { eyebrow, title, subtitle, body, imageUrl, imageAlt, actionLabel, actionHref, items } = renderModel;

  if (!eyebrow && !title && !subtitle && !body && !imageUrl && !items.length && !(actionLabel && actionHref)) {
    return null;
  }

  const Heading = section.kind === 'HERO' ? 'h1' : 'h2';
  return (
    <section data-section-kind={section.kind} id={section.key}>
      {eyebrow ? <p>{eyebrow}</p> : null}
      {title ? <Heading>{title}</Heading> : null}
      {subtitle ? <p>{subtitle}</p> : null}
      {imageUrl && imageAlt ? <img alt={imageAlt} decoding="async" loading={section.kind === 'HERO' ? 'eager' : 'lazy'} src={imageUrl} /> : null}
      {body ? <p>{body}</p> : null}
      {items.length ? (
        <ul>
          {items.map((item, index) => {
            const itemTitle = item.title;
            const itemBody = item.body;
            const itemHref = item.href;
            return (
              <li key={`${itemTitle ?? 'item'}-${index}`}>
                {itemTitle ? <strong>{itemTitle}</strong> : null}
                {itemBody ? <p>{itemBody}</p> : null}
                {itemHref ? <a href={itemHref}>{item.label ?? itemTitle ?? itemHref}</a> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {actionLabel && actionHref ? <a href={actionHref}>{actionLabel}</a> : null}
    </section>
  );
}

export function safePublicHref(value: unknown) {
  if (typeof value !== 'string') return null;
  const href = value.trim();
  if (href.startsWith('/') && !href.startsWith('//')) return href;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
