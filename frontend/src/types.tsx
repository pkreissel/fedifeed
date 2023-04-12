interface weightsType {
    [key: string]: number; // Replace 'any' with the desired value type (e.g., string, number, etc.)
}

enum scopeType {
    read_accounts = "read:accounts",
    read_blocks = "read:blocks",
    read_bookmarks = "read:bookmarks",
    read_favourites = "read:favourites",
    read_filters = "read:filters",
    read_follows = "read:follows",
    read_lists = "read:lists",
    read_mutes = "read:mutes",
    read_notifications = "read:notifications",
    read_search = "read:search",
    read_statuses = "read:statuses",
    write_accounts = "write:accounts",
    write_blocks = "write:blocks",
    write_bookmarks = "write:bookmarks",
    write_conversations = "write:conversations",
    write_favourites = "write:favourites",
    write_filters = "write:filters",
    write_follows = "write:follows",
    write_lists = "write:lists",
    write_media = "write:media",
    write_mutes = "write:mutes",
    write_notifications = "write:notifications",
    write_reports = "write:reports",
    write_statuses = "write:statuses",
}

type StatusType = {
    id: string;
    uri: string;
    url: string;
    account: {
        id: string;
        username: string;
        acct: string;
        display_name: string;
    },
    card?: {
        url: string;
        title: string;
        description: string;
        image: string;
    },
    weights?: weightsType;
    reblog?: StatusType;
    topPost?: boolean;
    inReplyToId: string;
    createdAt: string;
    value?: number;
    content: string;
    reblogged?: Boolean
}

export { weightsType, scopeType, StatusType }