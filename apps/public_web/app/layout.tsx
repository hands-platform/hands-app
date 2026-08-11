import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'HANDS',
    template: '%s | HANDS',
  },
  description: '원하는 장소와 시간에 검증된 웰니스 마사지 테라피스트를 만나는 HANDS.',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="ko">
      <body>{children}</body>
    </html>
  );
}
