type EmptyStateProps = {
    title: string;
    message: string;
};

export function EmptyState({ title, message }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-12">
            <div className="text-center">
                <h3 className="font-semibold font-serif text-lg">{title}</h3>
                <p className="mt-2 text-muted-foreground text-sm">{message}</p>
            </div>
        </div>
    );
}
