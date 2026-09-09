'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  ['/', 'Dashboard'],
  ['/generate', 'Generate letters'],
  ['/clients', 'Clients'],
  ['/letters', 'Saved letters'],
  ['/settings', 'Company settings'],
] as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Confirmation Letters</span>
          <nav className="nav">
            {LINKS.map(([href, label]) => (
              <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <button className="sm" onClick={logout}>Sign out</button>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
