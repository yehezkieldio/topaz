import { AuthActionForm } from "@/features/auth/components/auth-action-form";
import { getIsAdmin } from "@/server/auth/get-is-admin";

/**
 * getIsAdmin() reads headers() (a request-time API) -- under Cache
 * Components, that has to happen inside a Suspense boundary or the route
 * can't be prerendered at all (see blocking-prerender-runtime).
 */
export const AuthPanel = async () => {
  const isAdmin = await getIsAdmin();
  return <AuthActionForm isAdmin={isAdmin} />;
};
