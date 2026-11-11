import {
  createContext,
  useContext,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * melo's router.
 *
 * A desktop app doesn't need a server-side router: paths are plain
 * history entries, every view is already a client component, and the engine
 * lives behind /api. This keeps the same `Link` / `usePathname` / `useRouter`
 * shape the components were written against, so nothing else had to change.
 */

const listeners = new Set<(path: string) => void>();

function currentPath(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

export function navigate(to: string, options?: { replace?: boolean }) {
  if (typeof window === "undefined") return;
  if (to === currentPath()) return;
  if (options?.replace) window.history.replaceState(null, "", to);
  else window.history.pushState(null, "", to);
  listeners.forEach((listener) => listener(currentPath()));
}

export function usePathname(): string {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const listener = (next: string) => setPath(next);
    listeners.add(listener);
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return path;
}

export function useRouter() {
  return {
    push: (to: string) => navigate(to),
    replace: (to: string) => navigate(to, { replace: true }),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    prefetch: () => undefined,
    refresh: () => undefined,
  };
}

export const RouteContext = createContext<{ params: Record<string, string> }>({ params: {} });

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useContext(RouteContext).params as T;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
  /** Accepted for parity with the old API; a desktop app needs no prefetching. */
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
};

export function Link({ href, children, onClick, prefetch, replace, scroll, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    navigate(href, { replace });
  };

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}

export default Link;
