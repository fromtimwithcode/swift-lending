export const useParams = () => ({
  id: new URLSearchParams(window.location.search).get("id") ?? "loan-1",
});
export const usePathname = () => window.location.pathname;
export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  refresh: () => {},
});
