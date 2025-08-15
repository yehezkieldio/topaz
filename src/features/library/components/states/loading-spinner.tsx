type LoadingSpinnerProps = {
    message?: string;
};

export function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
    return (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="rounded-lg bg-background p-4 shadow-lg">
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />
                    <span className="text-muted-foreground text-sm">{message}</span>
                </div>
            </div>
        </div>
    );
}
