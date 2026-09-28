"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axiosInstance from "@/app/utils/axios";
import { systemInterface } from "@/app/types/system.type";
import useUserStore from "@/app/store/useUserStore";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { getApiErrorMessage } from "@/app/utils/apiError";
import { systemSettingsSchema } from "@/app/utils/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldError, RequiredMark } from "@/components/ui/formField";
import { LogoUploadModal } from "@/components/ui/logoUploadModal";
import { SystemImageUploadModal } from "@/components/ui/systemImageUploadModal";
import { AdminAccounts } from "./components/adminAccounts";
import { BackupRestore } from "./components/backupRestore";
import { AccessCodeSettings } from "./components/accessCodeSettings";
import { Loader2, Save, Building2, Sparkles, Layout } from "lucide-react";

type SettingsValues = z.input<typeof systemSettingsSchema>;

const toFormValues = (info?: systemInterface): SettingsValues => ({
  systemInfo: info?.systemInfo || "",
  paymentMin: info?.paymentMin?.toString() || "0",
  gracePeriodHours: info?.gracePeriodHours?.toString() || "2",
  systemName: info?.systemName || "",
  header: info?.header || "",
  description: info?.description || "",
  facebook: info?.facebook || "",
  contactEmail: info?.contactEmail || "",
});

export default function Page() {
  const queryClient = useQueryClient();
  const { user } = useUserStore();

  const { data: systemInfo, isLoading, isError } = useQuery<systemInterface>({
    queryKey: ["systeminfo"],
    queryFn: async (): Promise<systemInterface> => {
      const response = await axiosInstance.get("/system");
      return response.data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsValues>({
    resolver: zodResolver(systemSettingsSchema),
    mode: "onTouched",
    defaultValues: toFormValues(),
  });

  useEffect(() => {
    if (systemInfo) {
      reset(toFormValues(systemInfo));
    }
  }, [systemInfo, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: {
      systemInfo: string;
      paymentMin: number;
      gracePeriodHours: number;
      systemName: string;
      header: string;
      description: string;
      facebook: string;
      contactEmail: string;
    }) => axiosInstance.put("/system/info", data),
    onSuccess: () => {
      successAlert("System settings saved successfully.");
      queryClient.invalidateQueries({ queryKey: ["systeminfo"] });
    },
    onError: (err) => {
      errorAlert(getApiErrorMessage(err, "Failed to save settings."));
    },
  });

  const handleSave = handleSubmit((values) => {
    const parsed = systemSettingsSchema.parse(values);
    updateMutation.mutate({
      ...parsed,
      paymentMin: Number(parsed.paymentMin),
      gracePeriodHours: Number(parsed.gracePeriodHours),
    });
  });

  const hasChanges = isDirty;
  const inputCls = "mt-1 rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border-[#D9C3C3] text-xs font-medium";

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-2">
            System & Security
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[#130005] dark:text-white">
            System Configuration
          </h1>
          <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1">
            Manage branding, visual media showcase, and system knowledge for the guest portal.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-60 rounded-3xl" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="size-12 text-[#900546]/40 mb-3" />
          <h3 className="text-base font-bold text-[#130005] dark:text-white">
            Failed to Load Settings
          </h3>
          <p className="text-xs text-[#5C454B] mt-1">Could not fetch system information.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── Left Column: System Branding & Business Details ── */}
          <div className="lg:col-span-12 space-y-8">
            <form onSubmit={handleSave} className="space-y-8" noValidate>
              {/* Branding & Background Banners */}
              <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-6 shadow-xs">
                <div>
                  <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
                    <Layout className="size-4.5 text-[#900546]" />
                    Branding & Visual Banners
                  </h2>
                  <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
                    Customize the hotel logo and full-width background hero banner.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Brand Logo */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#130005] dark:text-white">Brand Emblem</Label>
                    <div className="flex justify-start">
                      {systemInfo?.logo ? (
                        <LogoUploadModal currentLogo={systemInfo.logo} />
                      ) : (
                        <LogoUploadModal currentLogo="" />
                      )}
                    </div>
                  </div>

                  {/* Hero Background */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#130005] dark:text-white">Hero Background Banner</Label>
                    <SystemImageUploadModal
                      field="heroBackground"
                      currentImage={systemInfo?.heroBackground}
                      title="Hero Banner Background"
                      description="Upload a high-resolution banner image for the hero slider."
                      previewAspectClass="aspect-[21/9]"
                    />
                  </div>
                </div>
              </section>

              {/* About Showcase Photos */}
              <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-5 shadow-xs">
                <div>
                  <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white flex items-center gap-2">
                    <Sparkles className="size-4.5 text-[#900546]" />
                    About Showcase Photographs (&ldquo;Sanctuary of Serenity&rdquo;)
                  </h2>
                  <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
                    Configure the 4 showcase photo cards displayed on the guest landing page.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-[#5C454B] dark:text-gray-400">Photo 1 (Suite)</Label>
                    <SystemImageUploadModal
                      field="aboutImg1"
                      currentImage={systemInfo?.aboutImg1}
                      title="About Photo 1 (Suite)"
                      description="Showcases the primary suite bedroom or luxury interior."
                      previewHeightClass="h-24"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-[#5C454B] dark:text-gray-400">Photo 2 (Lounge)</Label>
                    <SystemImageUploadModal
                      field="aboutImg2"
                      currentImage={systemInfo?.aboutImg2}
                      title="About Photo 2 (Lounge)"
                      description="Showcases the relaxing lounge or living area."
                      previewHeightClass="h-24"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-[#5C454B] dark:text-gray-400">Photo 3 (Pool)</Label>
                    <SystemImageUploadModal
                      field="aboutImg3"
                      currentImage={systemInfo?.aboutImg3}
                      title="About Photo 3 (Pool)"
                      description="Showcases the pool, garden, or terrace."
                      previewHeightClass="h-24"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-[#5C454B] dark:text-gray-400">Photo 4 (Ambiance)</Label>
                    <SystemImageUploadModal
                      field="aboutImg4"
                      currentImage={systemInfo?.aboutImg4}
                      title="About Photo 4 (Ambiance)"
                      description="Showcases the ambiance or dining."
                      previewHeightClass="h-24"
                    />
                  </div>
                </div>
              </section>

              {/* Property Details */}
              <section className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-6 space-y-4 shadow-xs">
                <div>
                  <h2 className="font-serif text-lg font-bold text-[#130005] dark:text-white">Business Information</h2>
                  <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-0.5">
                    Displayed on the guest site and used by the AI Concierge assistant.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="systemName" className="text-xs font-bold text-[#130005] dark:text-white">
                      Hotel Name <RequiredMark />
                    </Label>
                    <Input
                      id="systemName"
                      className={inputCls}
                      aria-invalid={!!errors.systemName}
                      {...register("systemName")}
                    />
                    <FieldError message={errors.systemName?.message} />
                  </div>

                  <div>
                    <Label htmlFor="header" className="text-xs font-bold text-[#130005] dark:text-white">Hero Tagline</Label>
                    <Input
                      id="header"
                      className={inputCls}
                      aria-invalid={!!errors.header}
                      {...register("header")}
                    />
                    <FieldError message={errors.header?.message} />
                  </div>

                  <div>
                    <Label htmlFor="facebook" className="text-xs font-bold text-[#130005] dark:text-white">Facebook Page URL</Label>
                    <p className="text-[10px] text-[#5C454B] dark:text-gray-400 mt-0.5">
                      Leave empty to hide the Facebook icon in the footer. When set, a link to this page appears.
                    </p>
                    <Input
                      id="facebook"
                      type="url"
                      placeholder="https://www.facebook.com/yourpage"
                      className={inputCls}
                      aria-invalid={!!errors.facebook}
                      {...register("facebook")}
                    />
                    <FieldError message={errors.facebook?.message} />
                  </div>

                  <div>
                    <Label htmlFor="contactEmail" className="text-xs font-bold text-[#130005] dark:text-white">Contact Email</Label>
                    <p className="text-[10px] text-[#5C454B] dark:text-gray-400 mt-0.5">
                      Inquiries submitted through the Contact Us form are sent to this address.
                    </p>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="reception@hotel.com"
                      className={inputCls}
                      aria-invalid={!!errors.contactEmail}
                      {...register("contactEmail")}
                    />
                    <FieldError message={errors.contactEmail?.message} />
                  </div>

                  <div>
                    <Label htmlFor="paymentMin" className="text-xs font-bold text-[#130005] dark:text-white">
                      Minimum Online Reservation Payment <RequiredMark />
                    </Label>
                    <p className="text-[10px] text-[#5C454B] dark:text-gray-400 mt-0.5">
                      Amount guests pay upfront (Stripe / PayMongo) to confirm an online reservation. Defaults to ₱1,000.
                    </p>
                    <Input
                      id="paymentMin"
                      type="number"
                      min={0}
                      placeholder="1000"
                      className={inputCls}
                      aria-invalid={!!errors.paymentMin}
                      {...register("paymentMin")}
                    />
                    <FieldError message={errors.paymentMin?.message} />
                  </div>

                  <div>
                    <Label htmlFor="gracePeriodHours" className="text-xs font-bold text-[#130005] dark:text-white">
                      Reservation Grace Period (hours) <RequiredMark />
                    </Label>
                    <p className="text-[10px] text-[#5C454B] dark:text-gray-400 mt-0.5">
                      How long a guest can arrive late (past the expected arrival time) before the reservation is marked OVERDUE and an overdue alert is sent. Defaults to 2.
                    </p>
                    <Input
                      id="gracePeriodHours"
                      type="number"
                      min={0}
                      step={0.5}
                      placeholder="2"
                      className={inputCls}
                      aria-invalid={!!errors.gracePeriodHours}
                      {...register("gracePeriodHours")}
                    />
                    <FieldError message={errors.gracePeriodHours?.message} />
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-xs font-bold text-[#130005] dark:text-white">Description</Label>
                    <Textarea
                      id="description"
                      rows={2}
                      className="mt-1 rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border-[#D9C3C3] text-xs leading-relaxed"
                      aria-invalid={!!errors.description}
                      {...register("description")}
                    />
                    <FieldError message={errors.description?.message} />
                  </div>

                  <div>
                    <Label htmlFor="systemInfo" className="text-xs font-bold text-[#130005] dark:text-white">
                      Hotel Information Knowledge Base for AI
                    </Label>
                    <p className="text-[10px] text-[#5C454B] dark:text-gray-400 mt-0.5">
                      The AI Assistant refers to these exact facts when interacting with guests.
                    </p>
                    <Textarea
                      id="systemInfo"
                      rows={6}
                      className="mt-1 rounded-xl bg-[#FAF5F5] dark:bg-[#130005] border-[#D9C3C3] text-xs leading-relaxed font-mono"
                      aria-invalid={!!errors.systemInfo}
                      {...register("systemInfo")}
                    />
                    <FieldError message={errors.systemInfo?.message} />
                  </div>
                </div>
              </section>

              {/* Save Button */}
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  disabled={!hasChanges || updateMutation.isPending}
                  className="rounded-2xl px-6 py-2.5 bg-[#900546] hover:bg-[#720336] text-white font-semibold text-xs shadow-md shadow-[#900546]/20 cursor-pointer"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Saving Settings...
                    </>
                  ) : (
                    <>
                      <Save className="size-4 mr-2" />
                      Save Configuration
                    </>
                  )}
                </Button>
                {!hasChanges && (
                  <span className="text-xs text-[#5C454B] dark:text-gray-400">All changes saved</span>
                )}
              </div>
            </form>

            <AccessCodeSettings />

           {(user?.type === "super admin" || user?.type === "admin") && (
  <>
    <AdminAccounts />
    <BackupRestore />
  </>
)}
          </div>
        </div>
      )}
    </div>
  );
}
