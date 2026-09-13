import { AuthActionForm } from "@/features/auth/components/auth-action-form";
import { getHasAccount, getIsAdmin } from "@/server/auth/get-is-admin";

/**
 * getIsAdmin()/getHasAccount() read headers()/query the db (request-time
 * work) -- under Cache Components, that has to happen inside a Suspense
 * boundary or the route can't be prerendered at all (see
 * blocking-prerender-runtime).
 */
export const AuthPanel = async () => {
  const [isAdmin, hasAccount] = await Promise.all([
    getIsAdmin(),
    getHasAccount(),
  ]);
  return <AuthActionForm hasAccount={hasAccount} isAdmin={isAdmin} />;
};
