"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "@/app/utils/axios";
import { roomInterface } from "@/app/types/room.type";
import { successAlert, errorAlert } from "@/app/utils/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2,
  LogIn,
  Check,
  ChevronLeft,
  ChevronRight,
  Bed,
  Users,
} from "lucide-react";
import {
  validateBookingForm,
  nightsBetween,
  todayDateStr,
  addDays,
  apiErrorMessage,
  FieldErrors,
  MAX_STAY_NIGHTS,
} from "@/app/utils/bookingValidation";

function getTodayDate() {
  return todayDateStr();
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[11px] font-medium text-destructive">{message}</p>;
}

function getNextIncrementedTime(intervalMinutes = 5) {
  const now = new Date();
  const ms = 1000 * 60 * intervalMinutes;
  const rounded = new Date(Math.ceil(now.getTime() / ms) * ms);
  const hh = String(rounded.getHours()).padStart(2, "0");
  const mm = String(rounded.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function CheckinModal() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [clientName, setClientName] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [arrivalDate, setArivalDate] = useState(getTodayDate());
  const [arrivalTime, setArivalTime] = useState(getNextIncrementedTime(5));
  const [departureDate, setDepartureDate] = useState(
    addDays(getTodayDate(), 1),
  );
  const [guests, setGuests] = useState("1");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const submitLock = useRef(false);

  // Sync state whenever modal is opened
  useEffect(() => {
    if (open) {
      const today = getTodayDate();
      setArivalDate(today);
      setArivalTime(getNextIncrementedTime(5));
      setDepartureDate(addDays(today, 1));
      setErrors({});
      setSubmitted(false);
      submitLock.current = false;
    }
  }, [open]);

  // Fetch all rooms and filter to "available" only
  const { data: rooms, isLoading: roomsLoading } = useQuery<roomInterface[]>({
    queryKey: ["rooms"],
    queryFn: async () => {
      const res = await axiosInstance.get("/room");
      return res.data;
    },
  });

  const availableRooms =
    rooms?.filter((room) => room.status === "available") ?? [];

  const selectedRoomDoc = rooms?.find((room) => room._id === selectedRoom);

  const formValues = useMemo(
    () => ({
      clientName,
      clientAddress,
      clientEmail,
      clientPhone,
      arrivalDate,
      arrivalTime,
      departureDate,
      guests,
    }),
    [
      clientName,
      clientAddress,
      clientEmail,
      clientPhone,
      arrivalDate,
      arrivalTime,
      departureDate,
      guests,
    ],
  );

  const liveErrors = useMemo(() => {
    const result = validateBookingForm(formValues, {
      requireEmail: false,
      maxHead: selectedRoomDoc?.maxHead,
    });
    if (!selectedRoom) result.room = "Please select an available room.";
    return result;
  }, [formValues, selectedRoomDoc?.maxHead, selectedRoom]);

  const visibleErrors = submitted ? liveErrors : errors;
  const nights = nightsBetween(arrivalDate, departureDate);

  const createBookingMutation = useMutation({
    mutationFn: (data: {
      clientName: string;
      clientAddress: string;
      clientEmail?: string;
      clientPhone?: string;
      type: string;
      status: string;
      arrivalDate: string;
      departureDate: string;
      arrivalTime: string;
      guests: number;
      room: string;
    }) => axiosInstance.post("/booking", data),
    onSuccess: () => {
      successAlert("Guest checked in successfully.");
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["active-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      resetForm();
      setOpen(false);
      submitLock.current = false;
    },
    onError: (err: unknown) => {
      errorAlert(apiErrorMessage(err, "Failed to check in guest."));
      submitLock.current = false;
    },
  });

  const resetForm = () => {
    setClientName("");
    setClientAddress("");
    setClientEmail("");
    setClientPhone("");
    setArivalDate(getTodayDate());
    setArivalTime(getNextIncrementedTime(5));
    setDepartureDate(addDays(getTodayDate(), 1));
    setGuests("1");
    setSelectedRoom("");
    setErrors({});
    setSubmitted(false);
  };

  const handleDateChange = (newDate: string) => {
    setArivalDate(newDate);
    if (newDate === getTodayDate()) {
      const now = new Date();
      const [h, m] = arrivalTime.split(":").map(Number);
      if (
        h < now.getHours() ||
        (h === now.getHours() && m < now.getMinutes())
      ) {
        setArivalTime(getNextIncrementedTime(5));
      }
    }
    if (!departureDate || nightsBetween(newDate, departureDate) < 1) {
      setDepartureDate(addDays(newDate, 1));
    }
  };

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const amount = 240;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -amount : amount,
        behavior: "smooth",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitLock.current || createBookingMutation.isPending) return;

    setSubmitted(true);
    setErrors(liveErrors);

    if (Object.keys(liveErrors).length > 0) {
      errorAlert(
        liveErrors.room ||
          "Please correct the highlighted fields before checking in.",
      );
      return;
    }

    submitLock.current = true;

    try {
      const fresh = await axiosInstance.get(`/room/${selectedRoom}`);
      const status = fresh.data?.status;
      if (status && status !== "available") {
        errorAlert(`This room is currently ${status} and cannot be assigned.`);
        queryClient.invalidateQueries({ queryKey: ["rooms"] });
        submitLock.current = false;
        return;
      }
    } catch {
      errorAlert("Could not confirm room availability. Please try again.");
      submitLock.current = false;
      return;
    }

    createBookingMutation.mutate({
      clientName: clientName.trim(),
      clientAddress: clientAddress.trim(),
      clientEmail: clientEmail.trim(),
      clientPhone: clientPhone.trim(),
      type: "walk in",
      status: "active",
      arrivalDate,
      departureDate,
      arrivalTime,
      guests: Number(guests),
      room: selectedRoom,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="flex items-center gap-2"
          onClick={() => setOpen(true)}
        >
          <LogIn className="size-4" />
          Check-in Guest
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check-in Guest</DialogTitle>
          <DialogDescription>
            Fill in the guest details and select an available room below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="clientName">
              Client Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clientName"
              placeholder="e.g. John Doe"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              aria-invalid={!!visibleErrors.clientName}
              maxLength={80}
            />
            <FieldError message={visibleErrors.clientName} />
          </div>

          {/* Client Address */}
          <div className="space-y-2">
            <Label htmlFor="clientAddress">
              Client Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="clientAddress"
              placeholder="e.g. 123 Main St, City"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              aria-invalid={!!visibleErrors.clientAddress}
              maxLength={160}
            />
            <FieldError message={visibleErrors.clientAddress} />
          </div>

          {/* Client Email & Phone - same row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client Email</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="e.g. john@email.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                aria-invalid={!!visibleErrors.clientEmail}
              />
              <FieldError message={visibleErrors.clientEmail} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientPhone">Client Phone</Label>
              <Input
                id="clientPhone"
                type="tel"
                placeholder="e.g. 0917 123 4567"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                aria-invalid={!!visibleErrors.clientPhone}
              />
              {visibleErrors.clientPhone ? (
                <FieldError message={visibleErrors.clientPhone} />
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  An email address or a contact number is required.
                </p>
              )}
            </div>
          </div>

          {/* Arrival Date & Time - same row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="arrivalDate">
                Arrival Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="arrivalDate"
                type="date"
                min={getTodayDate()}
                value={arrivalDate}
                onChange={(e) => handleDateChange(e.target.value)}
                aria-invalid={!!visibleErrors.arrivalDate}
              />
              <FieldError message={visibleErrors.arrivalDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="arrivalTime">
                Arrival Time <span className="text-destructive">*</span>
              </Label>
              <Input
                id="arrivalTime"
                type="time"
                step="300"
                value={arrivalTime}
                onChange={(e) => setArivalTime(e.target.value)}
                aria-invalid={!!visibleErrors.arrivalTime}
              />
              {visibleErrors.arrivalTime ? (
                <FieldError message={visibleErrors.arrivalTime} />
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  Increments in 5-minute intervals
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departureDate">
                Check-out Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="departureDate"
                type="date"
                min={addDays(arrivalDate || getTodayDate(), 1)}
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                aria-invalid={!!visibleErrors.departureDate}
              />
              {visibleErrors.departureDate ? (
                <FieldError message={visibleErrors.departureDate} />
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  {nights > 0
                    ? `${nights} night${nights === 1 ? "" : "s"} (max ${MAX_STAY_NIGHTS})`
                    : "Must be at least one night after check-in"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="guests">
                Number of Guests <span className="text-destructive">*</span>
              </Label>
              <Input
                id="guests"
                type="number"
                min={1}
                max={selectedRoomDoc?.maxHead || 20}
                step={1}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                aria-invalid={!!visibleErrors.guests}
              />
              {visibleErrors.guests ? (
                <FieldError message={visibleErrors.guests} />
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  {selectedRoomDoc
                    ? `Maximum ${selectedRoomDoc.maxHead || 2} guest(s) for this room`
                    : "Select a room to see its capacity"}
                </p>
              )}
            </div>
          </div>

          {/* Room Selection - scrollable horizontal cards */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Select Room <span className="text-destructive">*</span>
              </Label>
              {!roomsLoading && availableRooms.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {availableRooms.length} room
                  {availableRooms.length !== 1 && "s"} available
                </span>
              )}
            </div>

            {roomsLoading ? (
              <div className="flex items-center justify-center py-12 rounded-lg border border-dashed border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  <span className="text-sm">Loading rooms...</span>
                </div>
              </div>
            ) : availableRooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed border-border text-muted-foreground">
                <Bed className="size-8 mb-2" />
                <p className="text-sm font-medium">No available rooms</p>
                <p className="text-xs mt-1">
                  All rooms are currently occupied or under maintenance.
                </p>
              </div>
            ) : (
              <div className="relative group">
                {/* Scroll buttons */}
                <button
                  type="button"
                  onClick={() => scroll("left")}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-full bg-background/90 shadow-md border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scroll("right")}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-full bg-background/90 shadow-md border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent"
                >
                  <ChevronRight className="size-4" />
                </button>

                {/* Scrollable cards container */}
                <div
                  ref={scrollRef}
                  className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {availableRooms.map((room) => {
                    const isSelected = selectedRoom === room._id;
                    const discountedPrice =
                      room.discount > 0
                        ? Math.round(room.price * (1 - room.discount / 100))
                        : room.price;

                    return (
                      <button
                        type="button"
                        key={room._id}
                        onClick={() => setSelectedRoom(room._id)}
                        className={`
                          relative flex-shrink-0 w-[190px] rounded-xl border-2 text-left transition-all duration-200 overflow-hidden
                          ${
                            isSelected
                              ? "border-green-500 bg-green-50/50 dark:bg-green-950/20 shadow-md shadow-green-500/10 ring-1 ring-green-500"
                              : "border-border bg-card hover:border-muted-foreground/40 hover:shadow-sm"
                          }
                        `}
                      >
                        {/* Image */}
                        <div className="relative h-[105px] w-full overflow-hidden bg-muted">
                          {room.image ? (
                            <img
                              src={room.image}
                              alt={room.category}
                              className="size-full object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted-foreground">
                              <Bed className="size-8" />
                            </div>
                          )}

                          {/* Discount badge (Bottom Left) */}
                          {room.discount > 0 && (
                            <div className="absolute bottom-2 left-2 rounded bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-destructive-foreground shadow-xs">
                              {room.discount}% OFF
                            </div>
                          )}

                          {/* Selected checkmark badge (Top Right) */}
                          {isSelected && (
                            <div className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-green-500 text-white shadow-md">
                              <Check className="size-3.5" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-2.5 space-y-1.5">
                          {/* Room Number & Category */}
                          <div className="space-y-0.5">
                            <p
                              className="text-xs font-bold text-foreground truncate"
                              title={`${room.roomNumber ? `Room ${room.roomNumber} · ` : ""}${room.category}`}
                            >
                              {room.roomNumber
                                ? `Room ${room.roomNumber}`
                                : room.category}
                            </p>
                            {room.roomNumber ? (
                              <p className="text-[10px] text-muted-foreground truncate">
                                {room.category}
                              </p>
                            ) : null}
                          </div>

                          {/* Price */}
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-bold text-primary">
                              ₱{discountedPrice.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              / night
                            </span>
                            {room.discount > 0 && (
                              <span className="text-[10px] text-muted-foreground line-through ml-auto">
                                ₱{room.price.toLocaleString()}
                              </span>
                            )}
                          </div>

                          {/* Capacity & Amenities */}
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5 border-t border-border/60">
                            <span className="flex items-center gap-1">
                              <Users className="size-3 text-muted-foreground/70" />
                              {room.maxHead || 2} Guests
                            </span>
                            {room.amenities && room.amenities.length > 0 && (
                              <span
                                className="truncate max-w-[80px]"
                                title={room.amenities.join(", ")}
                              >
                                {room.amenities[0]}
                                {room.amenities.length > 1 &&
                                  ` +${room.amenities.length - 1}`}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <FieldError message={visibleErrors.room} />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createBookingMutation.isPending ||
                roomsLoading ||
                availableRooms.length === 0
              }
            >
              {createBookingMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Checking in...
                </>
              ) : (
                <>
                  <LogIn className="size-4" /> Check In
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
