import "server-only";

import { isAdministratorUser } from "#/server/auth/session";

type AuthUserGateProps = {
    children: (isAdministratorUser: boolean) => React.ReactNode;
};

export async function AuthUserGate({ children }: AuthUserGateProps) {
    return <>{children(await isAdministratorUser())}</>;
}
