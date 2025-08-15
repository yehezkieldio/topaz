import "server-only";

import { auth } from "#/server/auth";

interface AuthUserGateProps {
    children: (isAdministratorUser: boolean) => React.ReactNode;
}

export async function AuthUserGate({ children }: AuthUserGateProps) {
    const session = await auth();
    const isAdministratorUser = !!session?.user;

    return <>{children(isAdministratorUser)}</>;
}
