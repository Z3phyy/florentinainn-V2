"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { successAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { reservationCodeSchema, reviewSchema } from "@/app/utils/schemas";
import { reviewEligibility } from "@/app/types/review.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/formField";
import { StarRating } from "@/components/ui/starRating";
import { CheckCircle2, Clock, Loader2, MessageSquareHeart } from "lucide-react";

type Values = z.input<typeof reviewSchema>;
const codeFormSchema = z.object({ code: reservationCodeSchema });

export function RoomReviewPanel({
  reservationCode: initialCode,
  bookingId,
  roomId,
  bare,
  onDone,
}: {
  reservationCode?: string;
  bookingId?: string;
  roomId?: string;
  bare?: boolean;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState((initialCode || "").trim().toUpperCase());

  const identity = {
    reservationCode: code,
    ...(bookingId ? { bookingId } : {}),
    ...(roomId ? { roomId } : {}),
  };

  const eligibility = useQuery<reviewEligibility>({
    queryKey: ["review-eligibility", code, bookingId || "", roomId || ""],
    enabled: !!code,
    retry: false,
    queryFn: async () => (await axiosInstance.post("/review/eligibility", identity)).data,
  });

  const codeForm = useForm<z.input<typeof codeFormSchema>>({
    resolver: zodResolver(codeFormSchema),
    mode: "onTouched",
    defaultValues: { code: "" },
  });

  const form = useForm<Values>({
    resolver: zodResolver(reviewSchema),
    mode: "all",
    defaultValues: { rating: 0, comment: "" },
  });
  const errors = form.formState.errors;

  const submit = useMutation({
    mutationFn: (values: Values) =>
      axiosInstance.post("/review", { ...identity, rating: values.rating, comment: values.comment.trim() }),
    onSuccess: () => {
      successAlert("Thank you! Your review has been published.");
      queryClient.invalidateQueries({ queryKey: ["review-eligibility"] });
      queryClient.invalidateQueries({ queryKey: ["room-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["latest-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["track-booking"] });
      onDone?.();
    },
  });

  const wrapper = bare ? "space-y-4" : "rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-4";
  const title = bare ? null : (
    <h3 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
      <MessageSquareHeart className="size-5 text-[#900546]" />
      Review This Room
    </h3>
  );
  const resetCode = () => {
    setCode("");
    codeForm.reset({ code: "" });
  };

  if (!code) {
    return (
      <section className={wrapper}>
        {title}
        <p className="text-xs text-[#5C454B] dark:text-gray-400">
          Enter the reservation code from your confirmation to review the room you stayed in.
        </p>
        <form
          className="space-y-3"
          noValidate
          onSubmit={codeForm.handleSubmit((values) => setCode(values.code.trim().toUpperCase()))}
        >
          <FormField id="review-reservation-code" label="Reservation code" required error={codeForm.formState.errors.code?.message}>
            <Input
              id="review-reservation-code"
              placeholder="RES-XXXXX-XXXXX"
              className="font-mono uppercase"
              maxLength={20}
              autoComplete="off"
              aria-invalid={!!codeForm.formState.errors.code}
              {...codeForm.register("code")}
            />
          </FormField>
          <Button type="submit">Continue</Button>
        </form>
      </section>
    );
  }

  if (eligibility.isLoading) {
    return (
      <section className={wrapper}>
        {title}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Verifying your reservation...
        </p>
      </section>
    );
  }

  if (eligibility.isError) {
    return (
      <section className={wrapper}>
        {title}
        <p role="alert" className="text-xs text-destructive">
          {getApiErrorMessage(eligibility.error, "We could not verify this reservation code.")}
        </p>
        <Button size="sm" variant="outline" onClick={resetCode}>
          Try a different code
        </Button>
      </section>
    );
  }

  const data = eligibility.data;
  if (data?.reason === "already_reviewed" && data.review) {
    return (
      <section className={wrapper}>
        {title}
        <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">You already reviewed {data.roomLabel}.</p>
            <StarRating value={data.review.rating} readOnly size="sm" />
            <p className="text-[#130005] dark:text-white break-words">&ldquo;{data.review.comment}&rdquo;</p>
          </div>
        </div>
      </section>
    );
  }

  if (!data?.eligible) {
    return (
      <section className={wrapper}>
        {title}
        <p className="flex items-center gap-2 text-xs text-[#5C454B] dark:text-gray-400">
          <Clock className="size-4 shrink-0" />
          {data?.message || "You can review your room after you have checked out."}
        </p>
      </section>
    );
  }

  return (
    <section className={wrapper}>
      {title}
      <p className="text-xs text-[#5C454B] dark:text-gray-400">
        Reservation <span className="font-mono font-semibold">{code}</span> · How was your stay in {data.roomLabel}?
      </p>
      <form onSubmit={form.handleSubmit((values) => submit.mutate(values))} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            Rating <span className="text-rose-600" aria-hidden="true">*</span>
          </p>
          <Controller
            control={form.control}
            name="rating"
            render={({ field }) => (
              <StarRating
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  field.onBlur();
                }}
              />
            )}
          />
          {errors.rating?.message ? <p role="alert" className="text-xs font-medium text-destructive">{errors.rating.message}</p> : null}
        </div>
        <FormField id="review-comment" label="Your review" required error={errors.comment?.message} hint="10–1000 characters.">
          <Textarea id="review-comment" rows={4} maxLength={1000} aria-invalid={!!errors.comment} {...form.register("comment")} />
        </FormField>
        {submit.isError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {getApiErrorMessage(submit.error, "Failed to submit your review. Please try again.")}
          </p>
        ) : null}
        <Button type="submit" disabled={submit.isPending} className="bg-[#900546] hover:bg-[#720336] text-white">
          {submit.isPending ? <><Loader2 className="size-4 animate-spin" /> Submitting...</> : "Submit Review"}
        </Button>
      </form>
    </section>
  );
}
