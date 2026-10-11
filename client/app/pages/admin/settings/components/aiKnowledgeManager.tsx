"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { errorAlert, successAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { aiKnowledgeSchema } from "@/app/utils/schemas";
import { aiKnowledge, systemInterface } from "@/app/types/system.type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormField } from "@/components/ui/formField";
import { Bot, Database, Loader2, Plus, Save, Trash2, X } from "lucide-react";

type Values = z.input<typeof aiKnowledgeSchema>;
type TextKey = Exclude<keyof Values, "amenities" | "faqs">;

const CONTACT_FIELDS: { key: TextKey; label: string; placeholder: string; rows?: number }[] = [
  { key: "location", label: "Location / Address", placeholder: "Street, town, province" },
  { key: "contactPhone", label: "Contact Phone", placeholder: "0917 000 0000" },
  { key: "frontDesk", label: "Front Desk", placeholder: "Open 24/7. Located at the lobby.", rows: 2 },
  { key: "support", label: "Customer Support", placeholder: "Message us on Facebook or call the front desk.", rows: 2 },
];

const POLICY_FIELDS: { key: TextKey; label: string }[] = [
  { key: "checkInPolicy", label: "Check-in Policy" },
  { key: "checkOutPolicy", label: "Check-out Policy" },
  { key: "bookingPolicy", label: "Booking Policy" },
  { key: "cancellationPolicy", label: "Cancellation Policy" },
  { key: "refundPolicy", label: "Refund Policy" },
  { key: "paymentPolicy", label: "Payment Policy" },
  { key: "idRequirements", label: "ID Requirements" },
  { key: "houseRules", label: "House Rules" },
  { key: "petPolicy", label: "Pet Policy" },
  { key: "smokingPolicy", label: "Smoking Policy" },
  { key: "visitorPolicy", label: "Visitor Policy" },
  { key: "otherPolicies", label: "Other Policies" },
];

const AMENITY_SUGGESTIONS = [
  "Free WiFi",
  "Parking",
  "Breakfast",
  "Air conditioning",
  "Hot & cold shower",
  "Cable TV / DVD",
  "Generator / power backup",
];

const TEXT_KEYS: TextKey[] = [
  ...CONTACT_FIELDS.map((f) => f.key),
  ...POLICY_FIELDS.map((f) => f.key),
  "instructions",
  "systemInfo",
];

const toFormValues = (info?: systemInterface): Values => {
  const knowledge: Partial<aiKnowledge> = info?.aiKnowledge || {};
  const values = {} as Values;
  for (const key of TEXT_KEYS) {
    values[key] = key === "systemInfo" ? info?.systemInfo || "" : ((knowledge as Record<string, unknown>)[key] as string) || "";
  }
  values.amenities = (knowledge.amenities || []).map((value) => ({ value }));
  values.faqs = (knowledge.faqs || []).map((f) => ({ question: f.question, answer: f.answer }));
  return values;
};

const inputCls = "rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border-[#D9C3C3] text-xs";
const areaCls = "rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border-[#D9C3C3] text-xs leading-relaxed";

export function AiKnowledgeManager({ systemInfo }: { systemInfo?: systemInterface }) {
  const queryClient = useQueryClient();
  const [amenityDraft, setAmenityDraft] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(aiKnowledgeSchema),
    mode: "onTouched",
    defaultValues: toFormValues(),
  });
  const { register, control, handleSubmit, reset, formState } = form;
  const errors = formState.errors;
  const amenities = useFieldArray({ control, name: "amenities" });
  const faqs = useFieldArray({ control, name: "faqs" });

  useEffect(() => {
    if (systemInfo) reset(toFormValues(systemInfo));
  }, [systemInfo, reset]);

  const mutation = useMutation({
    mutationFn: (values: z.output<typeof aiKnowledgeSchema>) => {
      const { systemInfo: notes, amenities: amenityRows, faqs: faqRows, ...text } = values;
      return axiosInstance.put("/system/info", {
        systemInfo: notes,
        aiKnowledge: {
          ...text,
          amenities: amenityRows.map((a) => a.value),
          faqs: faqRows,
        },
      });
    },
    onSuccess: () => {
      successAlert("AI knowledge saved.");
      queryClient.invalidateQueries({ queryKey: ["systeminfo"] });
    },
    onError: (err) => errorAlert(getApiErrorMessage(err, "Failed to save AI knowledge.")),
  });

  const addAmenity = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const exists = amenities.fields.some((a) => a.value.toLowerCase() === value.toLowerCase());
    if (!exists) amenities.append({ value });
    setAmenityDraft("");
  };

  return (
    <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-6 shadow-xs">
      <div>
        <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
          <Bot className="size-4.5 text-[#900546]" />
          AI Concierge Knowledge
        </h2>
        <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5 max-w-3xl">
          General hotel facts the guest chatbot may use to answer questions. It only states what is written here.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[#900546]/20 bg-[#900546]/5 px-3 py-2 text-[11px] text-[#5C454B] dark:text-gray-300 max-w-3xl">
          <Database className="size-3.5 mt-0.5 shrink-0 text-[#900546]" />
          <span>
            Room availability, room rates, capacity, add-on prices and reservation or payment status are read live from the system. Do not type prices or availability here; manage them in Rooms and Add-ons.
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v as z.output<typeof aiKnowledgeSchema>))} className="space-y-6" noValidate>
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#130005] dark:text-white">Contact & Front Desk</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CONTACT_FIELDS.map((field) => (
              <FormField key={field.key} id={`ai-${field.key}`} label={field.label} error={errors[field.key]?.message}>
                {field.rows ? (
                  <Textarea id={`ai-${field.key}`} rows={field.rows} placeholder={field.placeholder} className={areaCls} {...register(field.key)} />
                ) : (
                  <Input id={`ai-${field.key}`} placeholder={field.placeholder} className={inputCls} {...register(field.key)} />
                )}
              </FormField>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#130005] dark:text-white">Policies</h3>
          <p className="text-[11px] text-[#5C454B] dark:text-gray-400">Leave a policy empty if it does not apply; the assistant will then say it does not have that information.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {POLICY_FIELDS.map((field) => (
              <FormField key={field.key} id={`ai-${field.key}`} label={field.label} error={errors[field.key]?.message}>
                <Textarea id={`ai-${field.key}`} rows={3} className={areaCls} {...register(field.key)} />
              </FormField>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#130005] dark:text-white">Hotel Amenities</h3>
          <div className="flex flex-wrap gap-1.5">
            {amenities.fields.length === 0 && (
              <span className="text-[11px] text-[#5C454B] dark:text-gray-400">No amenities listed yet.</span>
            )}
            {amenities.fields.map((field, index) => (
              <span key={field.id} className="inline-flex items-center gap-1 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#900546] dark:text-[#F968AC]">
                {field.value}
                <button type="button" onClick={() => amenities.remove(index)} className="cursor-pointer" aria-label={`Remove ${field.value}`}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 max-w-md">
            <Input
              value={amenityDraft}
              maxLength={120}
              onChange={(e) => setAmenityDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAmenity(amenityDraft);
                }
              }}
              placeholder="e.g. Free WiFi in all rooms"
              className={inputCls}
            />
            <Button type="button" variant="outline" onClick={() => addAmenity(amenityDraft)} disabled={!amenityDraft.trim()}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AMENITY_SUGGESTIONS.filter((s) => !amenities.fields.some((a) => a.value.toLowerCase() === s.toLowerCase())).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addAmenity(s)}
                className="rounded-full border border-dashed border-[#D9C3C3] px-2.5 py-0.5 text-[11px] text-[#5C454B] hover:border-[#900546]/50 cursor-pointer"
              >
                + {s}
              </button>
            ))}
          </div>
          <FieldError message={errors.amenities?.message || errors.amenities?.root?.message} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#130005] dark:text-white">Frequently Asked Questions</h3>
            <Button type="button" variant="outline" size="sm" onClick={() => faqs.append({ question: "", answer: "" })} disabled={faqs.fields.length >= 40}>
              <Plus className="size-4" /> Add FAQ
            </Button>
          </div>
          {faqs.fields.length === 0 && (
            <p className="text-[11px] text-[#5C454B] dark:text-gray-400">No FAQs yet. Example: &ldquo;Do you allow pets?&rdquo;</p>
          )}
          <div className="space-y-3">
            {faqs.fields.map((field, index) => (
              <div key={field.id} className="rounded-2xl border border-[#D9C3C3] dark:border-white/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Question"
                      className={inputCls}
                      aria-invalid={!!errors.faqs?.[index]?.question}
                      {...register(`faqs.${index}.question`)}
                    />
                    <FieldError message={errors.faqs?.[index]?.question?.message} />
                    <Textarea
                      rows={2}
                      placeholder="Answer"
                      className={areaCls}
                      aria-invalid={!!errors.faqs?.[index]?.answer}
                      {...register(`faqs.${index}.answer`)}
                    />
                    <FieldError message={errors.faqs?.[index]?.answer?.message} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => faqs.remove(index)} aria-label="Remove FAQ">
                    <Trash2 className="size-4 text-rose-600" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <FieldError message={errors.faqs?.message || errors.faqs?.root?.message} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            id="ai-systemInfo"
            label="Additional Hotel Notes"
            error={errors.systemInfo?.message}
            hint="Any other general facts about the hotel the assistant may share."
          >
            <Textarea id="ai-systemInfo" rows={6} className={`${areaCls} font-mono`} {...register("systemInfo")} />
          </FormField>
          <FormField
            id="ai-instructions"
            label="Assistant Instructions"
            error={errors.instructions?.message}
            hint="Tone or handling guidance for the assistant. Not shown to guests and cannot override its safety rules."
          >
            <Textarea
              id="ai-instructions"
              rows={6}
              placeholder="e.g. Recommend the Family Room to groups of 4 or more."
              className={areaCls}
              {...register("instructions")}
            />
          </FormField>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={!formState.isDirty || mutation.isPending}
            className="rounded-2xl px-6 py-2.5 bg-[#900546] hover:bg-[#720336] text-white font-semibold text-xs shadow-md shadow-[#900546]/20 cursor-pointer"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" /> Saving...
              </>
            ) : (
              <>
                <Save className="size-4 mr-2" /> Save AI Knowledge
              </>
            )}
          </Button>
          {!formState.isDirty && <span className="text-xs text-[#5C454B] dark:text-gray-400">All changes saved</span>}
        </div>
      </form>
    </section>
  );
}
