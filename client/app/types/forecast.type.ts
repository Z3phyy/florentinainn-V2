export type forecastConfidence = "insufficient" | "low" | "medium" | "high";

export interface forecastMonthlyRow {
    month: string;
    label: string;
    isPartial: boolean;
    isFuture: boolean;
    bookings: number;
    canceled: number;
    noShow: number;
    roomNights: number;
    capacityNights: number;
    occupancyRate: number;
    bookedRevenue: number;
    collectedRevenue: number | null;
    refunds: number | null;
    adr: number;
}

export interface forecastResult {
    generatedAt: string;
    timeZone: string;
    period: { from: string; to: string; months: number };
    horizon: number;
    filters: { roomCategory: string; categories: string[] };
    activeRooms: number;
    dataQuality: {
        historyMonths: number;
        completeMonths: number;
        monthsWithBookings: number;
        totalBookings: number;
        confidence: forecastConfidence;
        notes: string[];
    };
    totals: {
        bookings: number;
        canceled: number;
        noShow: number;
        cancellationRate: number;
        noShowRate: number;
        roomNights: number;
        occupancyRate: number;
        bookedRevenue: number;
        collectedRevenue: number | null;
        refunds: number | null;
        adr: number;
        avgLengthOfStay: number;
        avgLeadTimeDays: number;
    };
    trend: {
        comparedPeriods: string;
        bookingsChangePct: number | null;
        revenueChangePct: number | null;
        occupancyChangePts: number;
    } | null;
    monthly: forecastMonthlyRow[];
    seasonality: { month: string; averageBookings: number; indexVsAverage: number; samples: number }[];
    roomPerformance: {
        category: string;
        rooms: number;
        bookings: number;
        roomNights: number;
        occupancyRate: number;
        bookedRevenue: number;
        cancellationRate: number;
        bookingShare: number;
    }[];
    forecast: {
        method: string;
        months: { month: string; label: string; bookings: number; roomNights: number; occupancyRate: number; low: number; high: number }[];
    };
}

export interface forecastRecommendation {
    category: string;
    title: string;
    observedTrend: string;
    supportingMetric: string;
    implication: string;
    action: string;
}

export interface forecastAiResult {
    status: "ok" | "insufficient_data";
    confidence: forecastConfidence;
    summary: string;
    confidenceNote?: string;
    notes: string[];
    recommendations: forecastRecommendation[];
    metricsUsed: Record<string, unknown>;
    generatedAt: string;
    source: "ai" | "rules";
}

export interface forecastFilters {
    from: string;
    to: string;
    horizon: number;
    roomCategory: string;
}
