export interface reviewInterface {
    _id: string;
    rating: number;
    comment: string;
    guestName: string;
    stayArrivalDate?: string;
    stayDepartureDate?: string;
    createdAt: string;
}

export interface roomReviewsResult {
    items: reviewInterface[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    averageRating: number | null;
    reviewCount: number;
}

export interface reviewEligibility {
    eligible: boolean;
    reason?: "already_reviewed" | "not_completed";
    status?: string;
    roomLabel?: string;
    roomId?: string;
    message?: string;
    review?: reviewInterface;
}

export interface latestReviewsResult {
    items: (reviewInterface & { roomLabel?: string })[];
    averageRating: number | null;
    reviewCount: number;
}
