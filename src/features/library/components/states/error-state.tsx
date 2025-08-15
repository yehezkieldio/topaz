interface ErrorStateProps {
    title: string;
    message: string;
    onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
                <h3 className="font-semibold font-serif text-destructive text-lg">{title}</h3>
                <p className="mt-2 text-muted-foreground text-sm">{message}</p>
                {onRetry && (
                    <button
                        className="mt-4 rounded bg-secondary px-4 py-2 text-secondary-foreground hover:bg-secondary/80"
                        onClick={onRetry}
                        type="button"
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
}
