import { AuthUserGate } from "#/components/auth-user-gate";
import { LibraryClientProvider } from "#/features/library/components/list/library-client";

export default function Library() {
    return (
        <AuthUserGate>
            {(isAdministratorUser) => <LibraryClientProvider isAdministratorUser={isAdministratorUser} />}
        </AuthUserGate>
    );
}
