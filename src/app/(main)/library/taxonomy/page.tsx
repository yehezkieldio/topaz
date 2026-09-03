import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TaxonomyManageClient } from "#/features/library/components/taxonomy/taxonomy-manage-client";
import { isAdministratorUser } from "#/server/auth/session";

export const metadata = {
    description: "Manage Topaz taxonomy terms and relations.",
    title: "Manage Taxonomy | Topaz",
};

export default function TaxonomyManagePage() {
    return (
        <Suspense fallback={null}>
            <TaxonomyManageGate />
        </Suspense>
    );
}

async function TaxonomyManageGate() {
    if (!(await isAdministratorUser())) {
        redirect("/auth/unauthorized");
    }

    return <TaxonomyManageClient />;
}
