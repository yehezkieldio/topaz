import { Icons } from "#/components/icons";
import { Button } from "#/components/ui/button";
import { signIn, signOut } from "#/server/auth";

type AuthActionFormProps = {
    isAdministratorUser: boolean;
};

export function AuthActionForm({ isAdministratorUser }: AuthActionFormProps) {
    return isAdministratorUser ? (
        <form
            action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
            }}
        >
            <Button className="w-full" type="submit" variant="secondary">
                Sign out
            </Button>
        </form>
    ) : (
        <form
            action={async () => {
                "use server";
                await signIn("discord", { redirectTo: "/" });
            }}
        >
            <Button className="w-full" type="submit">
                <Icons.discord className="h-4 w-4 text-background" />
                Continue with Discord
            </Button>
        </form>
    );
}
