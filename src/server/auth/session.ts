import "server-only";

import { auth } from "#/server/auth";

export async function getCurrentSession() {
    return await auth();
}

export async function getCurrentUser() {
    const session = await getCurrentSession();
    return session?.user ?? null;
}

export async function isAdministratorUser() {
    return Boolean(await getCurrentUser());
}
