export type archiveType = "rooms" | "reservations" | "staff" | "reviews";

export interface archiveItem {
    _id: string;
    type: archiveType;
    name: string;
    detail: string;
    deletedAt: string;
    deletedBy: string;
    deleteReason: string;
}

export interface archiveListResult {
    items: archiveItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface adminReviewItem {
    _id: string;
    rating: number;
    comment: string;
    guestName: string;
    roomLabel: string;
    status: string;
    createdAt: string;
}

export interface adminReviewListResult {
    items: adminReviewItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
