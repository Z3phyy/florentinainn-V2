"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { addOnInterface } from "@/app/types/addOn.type";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function useAvailableAddOns(arrivalDate: string, departureDate = "", enabled = true) {
  const validDates =
    DATE_PATTERN.test(arrivalDate) &&
    (departureDate === "" || (DATE_PATTERN.test(departureDate) && departureDate > arrivalDate));
  return useQuery<addOnInterface[]>({
    queryKey: ["addons", arrivalDate, departureDate],
    enabled: enabled && validDates,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await axiosInstance.get("/addons", {
          params: departureDate ? { arrivalDate, departureDate } : { arrivalDate },
        })
      ).data,
  });
}
