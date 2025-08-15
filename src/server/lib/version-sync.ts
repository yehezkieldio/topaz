import { eq, sql } from "drizzle-orm";
import { db } from "#/server/db";
import { users } from "#/server/db/schema/user";

/**
 * Increments the library version for a user atomically.
 * This is used to track when library data changes across devices.
 */
export async function incrementUserLibraryVersion(userId: string): Promise<number> {
    const [updatedUser] = await db
        .update(users)
        .set({
            libraryVersion: sql`${users.libraryVersion} + 1`,
        })
        .where(eq(users.id, userId))
        .returning({ libraryVersion: users.libraryVersion });

    return updatedUser?.libraryVersion || 1;
}

/**
 * Gets the current library version for a user.
 */
export async function getUserLibraryVersion(userId: string): Promise<number> {
    const [user] = await db
        .select({ libraryVersion: users.libraryVersion })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    return user?.libraryVersion || 1;
}
