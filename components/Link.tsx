// Edge-request economy: prefetch-off Link wrapper (CLAUDE.md "Edge-request economy").
// Use this everywhere instead of bare `next/link` — default Next.js prefetch multiplies
// Vercel edge requests on every hover/viewport. Pass prefetch to override if ever needed.
import NextLink from 'next/link';
import type { ComponentProps } from 'react';

export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
