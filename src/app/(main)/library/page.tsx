import { AuthUserGate } from "#/components/auth-user-gate";
// import { LibraryClientProvider } from "#/features/library/components/list/library-client";
import { LibraryPage } from "#/features/new-library";

export default function Library() {
    return (
        <AuthUserGate>
            {/* {(isAdministratorUser) => <LibraryClientProvider isAdministratorUser={isAdministratorUser} />} */}
            {(isAdministratorUser) => <LibraryPage isAdministratorUser={isAdministratorUser} />}
        </AuthUserGate>
    );
}
