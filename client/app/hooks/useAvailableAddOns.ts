"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { addOnInterface } from "@/app/types/addOn.type";

export default function useAvailableAddOns(arrivalDate: string, departureDate: string, enabled = true) {
  const validDates = /^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) && /^\d{4}-\d{2}-\d{2}$/.test(departureDate) && departureDate > arrivalDate;
  return useQuery<addOnInterface[]>({
    queryKey: ["addons", arrivalDate, departureDate],
    enabled: enabled && validDates,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (await axiosInstance.get("/addons", { params: { arrivalDate, departureDate } })).data,
  });
}
