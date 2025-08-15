import "server-only";

import { auth } from "#/server/auth";

type AuthUserGateProps = {
    children: (isAdministratorUser: boolean) => React.ReactNode;
};

export async function AuthUserGate({ children }: AuthUserGateProps) {
    const session = await auth();
    const isAdministratorUser = Boolean(session?.user);

    return <>{children(isAdministratorUser)}</>;
}
