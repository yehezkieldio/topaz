import { Suspense } from "react";
import { AuthUserGate } from "#/components/auth-user-gate";
import { LibraryClientProvider } from "#/features/library/components/list/library-client";

export default function Library() {
    return (
        <Suspense fallback={<div>Loading library...</div>}>
            <AuthUserGate>
                {(isAdministratorUser) => <LibraryClientProvider isAdministratorUser={isAdministratorUser} />}
            </AuthUserGate>
        </Suspense>
    );
}
