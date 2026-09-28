"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { roomReviewsResult } from "@/app/types/review.type";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/ui/starRating";
import { MessageSquare } from "lucide-react";

export function RoomReviews({ roomId }: { roomId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch, isFetching } = useQuery<roomReviewsResult>({
    queryKey: ["room-reviews", roomId, page],
    enabled: !!roomId,
    placeholderData: keepPreviousData,
    queryFn: async () => (await axiosInstance.get(`/review/room/${roomId}`, { params: { page, limit: 5 } })).data,
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-2xl font-bold text-[#130005] dark:text-white">Guest Reviews</h2>
        {data && data.reviewCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <StarRating value={Math.round(data.averageRating || 0)} readOnly size="sm" />
            <span className="font-semibold">{data.averageRating?.toFixed(1)}</span>
            <span className="text-muted-foreground">({data.reviewCount} review{data.reviewCount === 1 ? "" : "s"})</span>
          </div>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <div className="flex items-center gap-3 text-sm text-destructive">
          Reviews could not be loaded.
          <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[#D9C3C3] dark:border-white/10 p-6 text-sm text-muted-foreground">
          <MessageSquare className="size-4" />
          No reviews yet. Reviews come from guests who have stayed in this room.
        </div>
      ) : (
        <div className={`space-y-3 ${isFetching ? "opacity-70" : ""}`}>
          {data.items.map((review) => (
            <article key={review._id} className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-4 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#130005] dark:text-white">{review.guestName}</p>
                <StarRating value={review.rating} readOnly size="sm" />
              </div>
              <p className="text-sm text-[#5C454B] dark:text-gray-300 whitespace-pre-line break-words">{review.comment}</p>
              <p className="text-[11px] text-muted-foreground">
                Verified stay · {new Date(review.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </article>
          ))}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-xs text-muted-foreground">Page {page} / {data.totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
