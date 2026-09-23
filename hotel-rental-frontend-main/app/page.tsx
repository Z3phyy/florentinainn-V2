"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import axiosInstance from "./utils/axios";
import { systemInterface } from "./types/system.type";
import { roomInterface } from "./types/room.type";
import { GuestChatWidget } from "@/components/ui/guestChatWidget";
import { HotelLocationMap } from "@/components/ui/hotelLocationMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Eye,
  X,
  SlidersHorizontal,
  Building2,
  Users,
  Shield,
  Loader2,
  Percent,
  Star,
  Quote,
  Mail,
  Phone,
  MapPin,
  Clock,
  ChevronRight,
  ArrowRight,
  Hotel,
  Award,
  MessageSquare,
  Send,
  Globe,
  Sparkles,
  Calendar,
  Bed,
  CheckCircle2,
  Utensils,
  Wifi,
  Waves,
  HeartHandshake,
  Sparkle,
  LogIn,
  CreditCard,
  ExternalLink,
  Wind,
  Droplets,
  Tv,
  Car,
  Zap,
  Search,
  ArrowUpDown,
  Tag,
  RotateCcw,
  Filter,
} from "lucide-react";
import { FacebookIcon } from "@/components/ui/facebookIcon";

// ── Mock Testimonials ──
const testimonials = [
  {
    id: 1,
    name: "Maria Santos",
    role: "Business Traveler",
    avatar: "MS",
    content:
      "Exceptional serenity and beautifully designed rooms. The warm hospitality and attention to detail made my stay unforgettable. Truly a 5-star haven.",
    rating: 5,
  },
  {
    id: 2,
    name: "James Rodriguez",
    role: "Family Vacation",
    avatar: "JR",
    content:
      "Our family had an extraordinary time. The suites were pristine, the pool area was breathtaking, and the 24/7 staff were genuinely accommodating.",
    rating: 5,
  },
  {
    id: 3,
    name: "Anna Kim",
    role: "Couples Getaway",
    avatar: "AK",
    content:
      "A hidden gem of luxury and tranquility! From the plush bedding to the gourmet breakfast, every moment was crafted for relaxation.",
    rating: 5,
  },
  {
    id: 4,
    name: "David Chen",
    role: "Frequent Guest",
    avatar: "DC",
    content:
      "I've stayed at boutique hotels worldwide, but Mellow's warm atmosphere and seamless service stand out. Highly recommended!",
    rating: 5,
  },
];

// ── Curated Hotel Amenities ──
const hotelAmenities = [
  {
    icon: Wind,
    title: "Airconditioned Rooms",
    description:
      "Fully air-conditioned suites ensuring cool, comfortable, and refreshing stays all day and night.",
  },
  {
    icon: Droplets,
    title: "Hot & Cold Shower",
    description:
      "Enjoy relaxing showers with adjustable hot and cold water temperature in your private bathroom.",
  },
  {
    icon: Tv,
    title: "Cable TV / DVD",
    description:
      "Complete in-room entertainment with high-definition cable TV channels and DVD movie access.",
  },
  {
    icon: Wifi,
    title: "Free WiFi Internet",
    description:
      "Fast and reliable complimentary wireless internet access available in all rooms and guest lounges.",
  },
  {
    icon: Utensils,
    title: "We Serve Breakfast",
    description:
      "Start your day with delicious, freshly prepared breakfast options served with warm hospitality.",
  },
  {
    icon: Car,
    title: "Private Parking",
    description:
      "Dedicated and secure on-site private parking area for all staying guests and family vehicles.",
  },
  {
    icon: Zap,
    title: "Backup Generator",
    description:
      "Guaranteed uninterrupted 24/7 power supply with our dedicated on-site backup generator system.",
  },
];

export default function Home() {
  const router = useRouter();

  // ── System info fetch ──
  const {
    data: systemInfo,
    isLoading: systemLoading,
    isError: systemError,
  } = useQuery<systemInterface>({
    queryKey: ["systeminfo"],
    queryFn: async (): Promise<systemInterface> => {
      const response = await axiosInstance.get("/system");
      return response.data;
    },
  });

  // ── Rooms fetch ──
  const {
    data: rooms,
    isLoading: roomsLoading,
    isError: roomsError,
  } = useQuery({
    queryKey: ["rooms"],
    queryFn: async (): Promise<roomInterface[]> => {
      const response = await axiosInstance.get("/room");
      return response.data;
    },
  });

  // ── Alt+Enter → login page ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "Enter") {
        e.preventDefault();
        router.push("/guest/login");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  // ── Hero Check Availability Form State ──
  const [heroCheckIn, setHeroCheckIn] = useState("");
  const [heroCheckOut, setHeroCheckOut] = useState("");
  const [heroCategory, setHeroCategory] = useState("all");
  const [heroGuests, setHeroGuests] = useState("1");

  // ── Contact form state ──
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [sendingContact, setSendingContact] = useState(false);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      toast.error("Please fill in all required fields (Name, Email, Message).");
      return;
    }
    setSendingContact(true);
    try {
      // Calls /system/contact which dispatches live chat, sends email via Brevo, and logs audit
      await axiosInstance.post("/system/contact", {
        name: contactName.trim(),
        email: contactEmail.trim(),
        subject: contactSubject.trim(),
        message: contactMessage.trim(),
      });

      toast.success(
        "Thank you! Your message has been sent to our reception team and an email confirmation was sent to your inbox.",
      );
      setContactName("");
      setContactEmail("");
      setContactSubject("");
      setContactMessage("");
    } catch (error) {
      console.error("Failed to deliver inquiry message:", error);
      toast.error(
        "Unable to deliver message right now. Please try again or reach us by phone.",
      );
    } finally {
      setSendingContact(false);
    }
  };

  // ── Room filter & search state ──
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [guestFilter, setGuestFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("featured");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [pricePreset, setPricePreset] = useState<string>("all");
  const [discountedOnly, setDiscountedOnly] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const categories = useMemo(() => {
    if (!rooms) return [];
    return [...new Set(rooms.map((r) => r.category))].sort();
  }, [rooms]);

  const categoryCounts = useMemo(() => {
    if (!rooms) return {} as Record<string, number>;
    const counts: Record<string, number> = { all: rooms.length };
    rooms.forEach((r) => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [rooms]);

  const availableCount = useMemo(() => {
    if (!rooms) return 0;
    return rooms.filter((r) => r.status === "available").length;
  }, [rooms]);

  const discountedCount = useMemo(() => {
    if (!rooms) return 0;
    return rooms.filter((r) => (r.discount || 0) > 0).length;
  }, [rooms]);

  const handlePricePreset = (preset: string) => {
    setPricePreset(preset);
    if (preset === "all") {
      setMinPrice("");
      setMaxPrice("");
    } else if (preset === "under-2k") {
      setMinPrice("");
      setMaxPrice("2000");
    } else if (preset === "2k-4k") {
      setMinPrice("2000");
      setMaxPrice("4000");
    } else if (preset === "above-4k") {
      setMinPrice("4000");
      setMaxPrice("");
    }
  };

  const filteredRooms = useMemo(() => {
    if (!rooms) return [];
    let list = rooms.filter((room) => {
      // Category filter
      if (
        categoryFilter !== "all" &&
        room.category.toLowerCase() !== categoryFilter.toLowerCase()
      )
        return false;
      // Search query (category, roomNumber, description, amenities)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const categoryMatch = room.category.toLowerCase().includes(query);
        const numberMatch = room.roomNumber
          ? room.roomNumber.toString().toLowerCase().includes(query)
          : false;
        const descMatch = room.description
          ? room.description.toLowerCase().includes(query)
          : false;
        const amenityMatch = room.amenities
          ? room.amenities.some((a) => a.toLowerCase().includes(query))
          : false;
        if (!categoryMatch && !numberMatch && !descMatch && !amenityMatch)
          return false;
      }
      // Min and max price
      const effectivePrice = Math.round(
        room.price * (1 - (room.discount || 0) / 100),
      );
      if (minPrice && effectivePrice < Number(minPrice)) return false;
      if (maxPrice && effectivePrice > Number(maxPrice)) return false;
      // Discounted only
      if (discountedOnly && (room.discount || 0) <= 0) return false;
      // Guest capacity
      if (guestFilter !== "all" && (room.maxHead || 2) < Number(guestFilter))
        return false;
      return true;
    });

    // Sorting
    if (sortBy === "price-asc") {
      list = [...list].sort((a, b) => {
        const priceA = Math.round(a.price * (1 - (a.discount || 0) / 100));
        const priceB = Math.round(b.price * (1 - (b.discount || 0) / 100));
        return priceA - priceB;
      });
    } else if (sortBy === "price-desc") {
      list = [...list].sort((a, b) => {
        const priceA = Math.round(a.price * (1 - (a.discount || 0) / 100));
        const priceB = Math.round(b.price * (1 - (b.discount || 0) / 100));
        return priceB - priceA;
      });
    } else if (sortBy === "discount-desc") {
      list = [...list].sort((a, b) => (b.discount || 0) - (a.discount || 0));
    }

    return list;
  }, [
    rooms,
    categoryFilter,
    searchQuery,
    minPrice,
    maxPrice,
    discountedOnly,
    guestFilter,
    sortBy,
  ]);

  const hasActiveFilters =
    categoryFilter !== "all" ||
    searchQuery.trim() !== "" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    discountedOnly ||
    guestFilter !== "all" ||
    sortBy !== "featured";

  const clearFilters = () => {
    setCategoryFilter("all");
    setSearchQuery("");
    setMinPrice("");
    setMaxPrice("");
    setPricePreset("all");
    setDiscountedOnly(false);
    setGuestFilter("all");
    setSortBy("featured");
  };

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroCategory !== "all") {
      setCategoryFilter(heroCategory);
    }
    if (heroGuests && heroGuests !== "1") {
      setGuestFilter(heroGuests);
    }
    scrollToSection("rooms-section");
    toast.success("Showing available suites tailored to your selection.");
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "available":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700";

      case "occupied":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700";

      case "reserved":
        return "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-700";

      case "maintenance":
        return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700";

      default:
        return "bg-muted text-foreground border-border";
    }
  };

  if (systemLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-4 bg-[#FAF5F5]">
        <Loader2 className="size-10 animate-spin text-[#900546]" />
        <p className="text-sm font-medium text-[#130005]">
          Loading luxury experience...
        </p>
      </div>
    );
  }

  if (systemError) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-3 px-6 text-center bg-[#FAF5F5]">
        <Building2 className="size-12 text-[#900546]/40" />
        <h2 className="text-xl font-serif font-bold text-[#130005]">
          Welcome to Our Hotel
        </h2>
        <p className="text-sm text-[#5C454B] max-w-xs">
          Could not connect to the booking service. Please refresh or try again.
        </p>
      </div>
    );
  }

  const hotelName = systemInfo?.systemName || "Florentina Inn";
  const logoUrl = systemInfo?.logo || "/Florentina Inn Logo.png";

  return (
    <div className="flex flex-col min-h-screen bg-[#FAF5F5] dark:bg-[#130005] text-[#130005] dark:text-gray-100 font-sans antialiased selection:bg-[#900546]/20 selection:text-[#900546]">
      {/* Unified Luxury Floating Concierge Widget */}
      <GuestChatWidget />

      {/* ─────────────────────────────────────────────── */}
      {/* 1. TOP INFO BAR (Florentina Palette)            */}
      {/* ─────────────────────────────────────────────── */}
      <div className="border-b border-[#D9C3C3] dark:border-white/10 bg-[#E4D1D1]/40 dark:bg-[#1C050E] py-2 px-4 sm:px-8 text-xs text-[#5C454B] dark:text-gray-300">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left contact info */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <span className="inline-flex items-center gap-1.5 hover:text-[#900546] transition-colors">
              <MapPin className="size-3.5 text-[#618685]" />
              Francia Sur, Jose D. Aspiras Hwy, Tubao, La Union
            </span>
            <span className="inline-flex items-center gap-1.5 hover:text-[#900546] transition-colors">
              <Clock className="size-3.5 text-[#618685]" />
              Open 24/7 Front Desk
            </span>
          </div>

          {/* Right luxury tagline */}
          <div className="hidden sm:flex items-center gap-2 text-[#900546] dark:text-[#F968AC] font-semibold">
            <Sparkles className="size-3 text-[#F968AC]" />
            <span>Luxury Boutique Accommodations</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────── */}
      {/* 2. PRIMARY NAVIGATION HEADER                    */}
      {/* ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#130005]/95 backdrop-blur-md border-b border-[#D9C3C3] dark:border-white/10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between">
          {/* Logo & Hotel Brand */}
          <div
            onClick={() => scrollToSection("hero-section")}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="size-12 rounded-xl overflow-hidden bg-white p-1 border border-[#D9C3C3] group-hover:border-[#900546]/60 transition-all flex items-center justify-center shadow-xs">
              <img
                src={logoUrl}
                alt={hotelName}
                className="size-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "/Florentina Inn Logo.png";
                }}
              />
            </div>
            <div>
              <span className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#130005] dark:text-white leading-none block">
                {hotelName}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-[#900546] dark:text-[#F968AC] font-semibold block mt-0.5">
                Comfort & Affordable Accommodations
              </span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-[#130005] dark:text-gray-200">
            <button
              onClick={() => scrollToSection("hero-section")}
              className="hover:text-[#900546] transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => scrollToSection("about-section")}
              className="hover:text-[#900546] transition-colors cursor-pointer"
            >
              About
            </button>
            <button
              onClick={() => scrollToSection("rooms-section")}
              className="hover:text-[#900546] transition-colors cursor-pointer"
            >
              Rooms & Suites
            </button>
            <button
              onClick={() => scrollToSection("amenities-section")}
              className="hover:text-[#900546] transition-colors cursor-pointer"
            >
              Amenities
            </button>
            <button
              onClick={() => scrollToSection("reviews-section")}
              className="hover:text-[#900546] transition-colors cursor-pointer"
            >
              Reviews
            </button>
            <button
              onClick={() => scrollToSection("contact-section")}
              className="hover:text-[#900546] transition-colors cursor-pointer"
            >
              Contact
            </button>
          </nav>

          {/* Header Action Button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => scrollToSection("rooms-section")}
              className="bg-[#900546] hover:bg-[#720336] text-white rounded-full px-5 sm:px-6 h-10 text-xs sm:text-sm font-medium shadow-md shadow-[#900546]/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              Book A Room
              <ArrowRight className="size-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ─────────────────────────────────────────────── */}
      {/* 3. HERO SLIDER & AVAILABILITY CARD              */}
      {/* ─────────────────────────────────────────────── */}
      <section
        id="hero-section"
        className="relative py-16 lg:py-24 overflow-hidden border-b border-[#D9C3C3] dark:border-white/10 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(19, 0, 5, 0.82) 0%, rgba(144, 5, 70, 0.45) 50%, rgba(19, 0, 5, 0.85) 100%), url(${
            systemInfo?.heroBackground ||
            "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2000&q=80"
          })`,
        }}
      >
        {/* Soft atmospheric background glow */}
        <div className="absolute top-0 right-1/4 size-96 bg-[#F968AC]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 size-72 bg-[#900546]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Headline & Story */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F968AC]/40 bg-[#900546]/40 backdrop-blur-md px-4 py-1.5 text-xs font-semibold text-[#F968AC]">
                <Sparkles className="size-3.5 text-[#F968AC]" />
                Your Gateway to Serenity & Comfort
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-white leading-[1.14] drop-shadow-md">
                {systemInfo?.header ||
                  "Comfortable and Affordable Rooms for Every Stay"}
              </h1>

              <p className="text-base sm:text-lg text-gray-200 leading-relaxed max-w-xl font-normal drop-shadow-sm">
                {systemInfo?.description ||
                  "Florentina Inn offers clean, secure, and affordable room accommodations for travelers, families, and business guests. Enjoy comfortable rooms, modern amenities, and excellent customer service."}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Button
                  size="lg"
                  onClick={() => scrollToSection("rooms-section")}
                  className="bg-[#900546] hover:bg-[#720336] text-white rounded-full px-7 h-12 text-sm font-medium shadow-lg shadow-[#900546]/35 transition-transform hover:-translate-y-0.5 cursor-pointer"
                >
                  Explore Rooms & Suites
                  <ArrowRight className="size-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => scrollToSection("about-section")}
                  className="border-white/30 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 rounded-full px-6 h-12 text-sm cursor-pointer"
                >
                  Our Story
                </Button>
              </div>

              {/* Quick trust metrics */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/20 max-w-lg">
                <div>
                  <span className="font-serif text-2xl font-bold text-white block">
                    100%
                  </span>
                  <span className="text-xs text-gray-300">Verified Stays</span>
                </div>
                <div>
                  <span className="font-serif text-2xl font-bold text-[#F968AC] block">
                    4.9 ★
                  </span>
                  <span className="text-xs text-gray-300">Guest Rating</span>
                </div>
                <div>
                  <span className="font-serif text-2xl font-bold text-white block">
                    24/7
                  </span>
                  <span className="text-xs text-gray-300">Live Front Desk</span>
                </div>
              </div>
            </div>

            {/* Right: Floating Check Availability Card */}
            <div className="lg:col-span-5">
              <div className="bg-white/95 dark:bg-[#1E1216]/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/40 dark:border-white/10 relative">
                <div className="flex items-center justify-between pb-4 border-b border-[#D9C3C3] dark:border-white/10 mb-6">
                  <div>
                    <h3 className="font-serif text-2xl font-bold text-[#130005] dark:text-white">
                      Check Availability
                    </h3>
                    <p className="text-xs text-[#5C454B] dark:text-gray-300 mt-0.5">
                      Find & reserve your preferred suite
                    </p>
                  </div>
                  <div className="size-10 rounded-2xl bg-[#900546]/10 text-[#900546] dark:text-[#F968AC] flex items-center justify-center">
                    <Calendar className="size-5" />
                  </div>
                </div>

                <form onSubmit={handleHeroSearch} className="space-y-4">
                  {/* Arrival Date */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-[#5C454B] dark:text-gray-300">
                      Check-In Date
                    </Label>
                    <div className="relative">
                      <Input
                        type="date"
                        value={heroCheckIn}
                        onChange={(e) => setHeroCheckIn(e.target.value)}
                        className="h-11 bg-[#FAF5F5] dark:bg-[#251E20] border-[#D9C3C3] dark:border-white/10 rounded-xl text-xs font-medium focus-visible:ring-[#900546]"
                      />
                    </div>
                  </div>

                  {/* Room Category */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-[#5C454B] dark:text-gray-300">
                      Room Category / Suite
                    </Label>
                    <Select
                      value={heroCategory}
                      onValueChange={setHeroCategory}
                    >
                      <SelectTrigger className="h-11 bg-[#FAF5F5] dark:bg-[#251E20] border-[#D9C3C3] dark:border-white/10 rounded-xl text-xs">
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Room Types</SelectItem>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Guests count */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-[#5C454B] dark:text-gray-300">
                      Number of Guests
                    </Label>
                    <Select value={heroGuests} onValueChange={setHeroGuests}>
                      <SelectTrigger className="h-11 bg-[#FAF5F5] dark:bg-[#251E20] border-[#D9C3C3] dark:border-white/10 rounded-xl text-xs">
                        <SelectValue placeholder="1 Guest" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Guest</SelectItem>
                        <SelectItem value="2">2 Guests</SelectItem>
                        <SelectItem value="3">3 Guests</SelectItem>
                        <SelectItem value="4">4+ Guests (Family)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Submit CTA */}
                  <Button
                    type="submit"
                    className="w-full bg-[#900546] hover:bg-[#720336] text-white rounded-xl h-12 text-sm font-semibold shadow-lg shadow-[#900546]/20 mt-2 transition-all cursor-pointer"
                  >
                    Check Available Suites
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────── */}
      {/* 4. KEY HIGHLIGHT METRICS BAR                    */}
      {/* ─────────────────────────────────────────────── */}
      <section className="bg-white dark:bg-[#1A0A10] py-10 border-b border-[#D9C3C3] dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-x divide-[#D9C3C3]/60 dark:divide-white/10">
            <div className="p-2">
              <h3 className="font-serif text-3xl sm:text-4xl font-bold text-[#900546]">
                {rooms?.length || 0}+
              </h3>
              <p className="text-xs uppercase tracking-wider font-semibold text-[#5C454B] dark:text-gray-300 mt-1">
                Luxury Suites
              </p>
            </div>
            <div className="p-2">
              <h3 className="font-serif text-3xl sm:text-4xl font-bold text-[#900546]">
                4.9 ★
              </h3>
              <p className="text-xs uppercase tracking-wider font-semibold text-[#5C454B] dark:text-gray-300 mt-1">
                Guest Score
              </p>
            </div>
            <div className="p-2">
              <h3 className="font-serif text-3xl sm:text-4xl font-bold text-[#900546]">
                100%
              </h3>
              <p className="text-xs uppercase tracking-wider font-semibold text-[#5C454B] dark:text-gray-300 mt-1">
                Guest Satisfaction
              </p>
            </div>
            <div className="p-2">
              <h3 className="font-serif text-3xl sm:text-4xl font-bold text-[#900546]">
                24/7
              </h3>
              <p className="text-xs uppercase tracking-wider font-semibold text-[#5C454B] dark:text-gray-300 mt-1">
                Reception Service
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────── */}
      {/* 5. ABOUT / SERENITY STORY SECTION               */}
      {/* ─────────────────────────────────────────────── */}
      <section
        id="about-section"
        className="py-16 lg:py-24 bg-[#E4D1D1]/30 dark:bg-[#130005] border-b border-[#D9C3C3] dark:border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Editorial Story */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3.5 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC]">
                About {hotelName}
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#130005] dark:text-white leading-tight">
                A Sanctuary of Serenity, Comfort & Warm Hospitality
              </h2>
              <p className="text-sm sm:text-base text-[#5C454B] dark:text-gray-300 leading-relaxed">
                Welcome to {hotelName}, where tranquility meets modern boutique
                comfort. Designed to offer a peaceful haven away from the busy
                daily grind, our hotel combines refined architecture, lush
                landscapes, and personalized service.
              </p>
              <p className="text-sm sm:text-base text-[#5C454B] dark:text-gray-300 leading-relaxed">
                Whether you are visiting for a weekend escape, a special
                celebration, or a relaxing staycation, our dedicated staff
                ensures every detail of your stay is effortless and memorable.
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-5 text-[#618685] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[#130005] dark:text-white">
                      Seamless Check-in
                    </h4>
                    <p className="text-xs text-[#5C454B] dark:text-gray-400">
                      Instant room key handover
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-5 text-[#618685] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[#130005] dark:text-white">
                      Flexible Payments
                    </h4>
                    <p className="text-xs text-[#5C454B] dark:text-gray-400">
                      Cash, GCash & Online
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  onClick={() => scrollToSection("rooms-section")}
                  className="bg-[#900546] hover:bg-[#720336] text-white rounded-full px-6 h-11 text-xs font-semibold shadow-md cursor-pointer"
                >
                  Explore Our Rooms
                  <ArrowRight className="size-4 ml-1.5" />
                </Button>
              </div>
            </div>

            {/* Asymmetrical visual showcase */}
            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="rounded-3xl overflow-hidden shadow-lg border border-[#D9C3C3] dark:border-white/10 h-48 sm:h-64 bg-muted">
                  <img
                    src={
                      systemInfo?.aboutImg1 ||
                      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80"
                    }
                    alt="Luxury Suite Interior"
                    className="size-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <div className="rounded-3xl overflow-hidden shadow-lg border border-[#D9C3C3] dark:border-white/10 h-36 sm:h-48 bg-muted">
                  <img
                    src={
                      systemInfo?.aboutImg2 ||
                      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80"
                    }
                    alt="Relaxing Lounge"
                    className="size-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                </div>
              </div>
              <div className="space-y-4 pt-6">
                <div className="rounded-3xl overflow-hidden shadow-lg border border-[#D9C3C3] dark:border-white/10 h-40 sm:h-52 bg-muted">
                  <img
                    src={
                      systemInfo?.aboutImg3 ||
                      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80"
                    }
                    alt="Swimming Pool"
                    className="size-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <div className="rounded-3xl overflow-hidden shadow-lg border border-[#D9C3C3] dark:border-white/10 h-48 sm:h-60 bg-muted">
                  <img
                    src={
                      systemInfo?.aboutImg4 ||
                      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"
                    }
                    alt="Boutique Ambiance"
                    className="size-full object-cover hover:scale-105 transition-transform duration-700"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────── */}
      {/* 6. ROOMS & SUITES CATALOG & ADVANCED FILTERS    */}
      {/* ─────────────────────────────────────────────── */}
      <section
        id="rooms-section"
        className="py-16 lg:py-24 bg-white dark:bg-[#130005] border-b border-[#D9C3C3] dark:border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-8">
          {/* ── Section Title & Subtitle ── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#D9C3C3] dark:border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3.5 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-3">
                <Sparkles className="size-3.5" />
                Curated Accommodations
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#130005] dark:text-white">
                Explore Our Rooms & Suites
              </h2>
              <p className="text-sm text-[#5C454B] dark:text-gray-300 mt-2 max-w-xl">
                Select from our collection of suites designed for serenity,
                comfort, and peaceful luxury.
              </p>
            </div>

            {/* Quick Status Stats */}
            <div className="flex items-center gap-2 text-xs font-medium text-[#5C454B] dark:text-gray-300">
              <span className="inline-flex items-center gap-1.5 bg-[#FAF5F5] dark:bg-[#221017] px-3.5 py-1.5 rounded-full border border-[#D9C3C3] dark:border-white/10">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                <strong className="text-[#130005] dark:text-white">
                  {availableCount}
                </strong>{" "}
                Available
              </span>
              {discountedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-[#900546]/10 text-[#900546] dark:text-[#F968AC] px-3.5 py-1.5 rounded-full border border-[#900546]/20 font-semibold">
                  <Tag className="size-3 text-[#F968AC]" />
                  {discountedCount} Special Offers
                </span>
              )}
            </div>
          </div>

          {/* ── 1. Category Navigation Tabs Strip ── */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer ${
                  categoryFilter === "all"
                    ? "bg-[#900546] text-white shadow-md shadow-[#900546]/25 scale-102"
                    : "bg-[#FAF5F5] dark:bg-[#221017] text-[#130005] dark:text-gray-300 border border-[#D9C3C3] dark:border-white/10 hover:border-[#900546] hover:text-[#900546]"
                }`}
              >
                All Accommodations
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    categoryFilter === "all"
                      ? "bg-white/20 text-white font-bold"
                      : "bg-black/5 dark:bg-white/10 text-[#5C454B] dark:text-gray-400"
                  }`}
                >
                  {rooms?.length || 0}
                </span>
              </button>

              {categories.map((cat) => {
                const isActive =
                  categoryFilter.toLowerCase() === cat.toLowerCase();
                const count = categoryCounts[cat] || 0;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(isActive ? "all" : cat)}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 cursor-pointer ${
                      isActive
                        ? "bg-[#900546] text-white shadow-md shadow-[#900546]/25 scale-102"
                        : "bg-[#FAF5F5] dark:bg-[#221017] text-[#130005] dark:text-gray-300 border border-[#D9C3C3] dark:border-white/10 hover:border-[#900546] hover:text-[#900546]"
                    }`}
                  >
                    {cat}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        isActive
                          ? "bg-white/20 text-white font-bold"
                          : "bg-black/5 dark:bg-white/10 text-[#5C454B] dark:text-gray-400"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── 2. Modern Filter & Search Toolbar ── */}
          <div className="bg-[#E4D1D1]/30 dark:bg-[#1E0E14] rounded-3xl p-4 sm:p-5 border border-[#D9C3C3] dark:border-white/10 shadow-xs space-y-4">
            {/* Top Toolbar Row */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[#618685]" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search suites by name, unit number, or amenity..."
                  className="pl-11 pr-10 h-12 bg-white dark:bg-[#130005] border-[#D9C3C3] dark:border-white/10 rounded-2xl text-xs font-medium focus-visible:ring-[#900546]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 size-6 rounded-full bg-muted/60 flex items-center justify-center text-[#5C454B] hover:text-[#900546] dark:hover:text-white cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Sort Order Selector */}
              <div className="w-full sm:w-56 shrink-0">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-12 bg-white dark:bg-[#130005] border-[#D9C3C3] dark:border-white/10 rounded-2xl text-xs font-medium">
                    <div className="flex items-center gap-1.5 truncate">
                      <ArrowUpDown className="size-3.5 text-[#900546]" />
                      <SelectValue placeholder="Sort By" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="featured">Featured Suites</SelectItem>
                    <SelectItem value="price-asc">
                      Price: Low to High
                    </SelectItem>
                    <SelectItem value="price-desc">
                      Price: High to Low
                    </SelectItem>
                    <SelectItem value="discount-desc">
                      Highest Discount
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* More Filters Toggle */}
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`inline-flex items-center justify-center gap-2 h-12 px-5 rounded-2xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  showAdvancedFilters ||
                  minPrice ||
                  maxPrice ||
                  guestFilter !== "all" ||
                  discountedOnly
                    ? "bg-[#900546] text-white shadow-md shadow-[#900546]/20"
                    : "bg-white dark:bg-[#130005] text-[#130005] dark:text-white border border-[#D9C3C3] dark:border-white/10 hover:border-[#900546]"
                }`}
              >
                <SlidersHorizontal className="size-3.5" />
                <span>More Filters</span>
                {(minPrice ||
                  maxPrice ||
                  guestFilter !== "all" ||
                  discountedOnly) && (
                  <span className="size-2 rounded-full bg-[#F968AC] animate-pulse" />
                )}
              </button>
            </div>

            {/* ── Expandable Advanced Filters Panel ── */}
            {showAdvancedFilters && (
              <div className="pt-4 border-t border-[#D9C3C3] dark:border-white/10 grid grid-cols-1 md:grid-cols-3 gap-5 animate-in fade-in slide-in-from-top-2 duration-300">
                {/* Price Filter & Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#5C454B] dark:text-gray-300">
                      Price Range
                    </Label>
                    {(minPrice || maxPrice) && (
                      <span className="text-[11px] font-semibold text-[#900546] dark:text-[#F968AC]">
                        ₱{minPrice || "0"} - {maxPrice ? `₱${maxPrice}` : "Any"}
                      </span>
                    )}
                  </div>

                  {/* Presets */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: "all", label: "All" },
                      { id: "under-2k", label: "< ₱2k" },
                      { id: "2k-4k", label: "₱2k-4k" },
                      { id: "above-4k", label: "> ₱4k" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handlePricePreset(p.id)}
                        className={`py-1 px-2 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                          pricePreset === p.id
                            ? "bg-[#900546] text-white border-[#900546]"
                            : "bg-white dark:bg-[#130005] border-[#D9C3C3] dark:border-white/10 text-[#130005] dark:text-gray-300 hover:border-[#900546]"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom inputs */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Input
                      type="number"
                      placeholder="Min ₱"
                      value={minPrice}
                      onChange={(e) => {
                        setMinPrice(e.target.value);
                        setPricePreset("custom");
                      }}
                      className="h-9 bg-white dark:bg-[#130005] border-[#D9C3C3] dark:border-white/10 rounded-xl text-xs focus-visible:ring-[#900546]"
                    />
                    <Input
                      type="number"
                      placeholder="Max ₱"
                      value={maxPrice}
                      onChange={(e) => {
                        setMaxPrice(e.target.value);
                        setPricePreset("custom");
                      }}
                      className="h-9 bg-white dark:bg-[#130005] border-[#D9C3C3] dark:border-white/10 rounded-xl text-xs focus-visible:ring-[#900546]"
                    />
                  </div>
                </div>

                {/* Guest Capacity */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#5C454B] dark:text-gray-300">
                    Minimum Guest Capacity
                  </Label>
                  <Select value={guestFilter} onValueChange={setGuestFilter}>
                    <SelectTrigger className="h-10 bg-white dark:bg-[#130005] border-[#D9C3C3] dark:border-white/10 rounded-xl text-xs font-medium">
                      <SelectValue placeholder="Any Capacity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Capacity</SelectItem>
                      <SelectItem value="1">1+ Guest</SelectItem>
                      <SelectItem value="2">2+ Guests</SelectItem>
                      <SelectItem value="3">3+ Guests</SelectItem>
                      <SelectItem value="4">4+ Guests (Family)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-[#5C454B] dark:text-gray-400">
                    Filter suites that accommodate your group size.
                  </p>
                </div>

                {/* Special Offers & Reset */}
                <div className="space-y-3 flex flex-col justify-between">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#5C454B] dark:text-gray-300 block mb-2">
                      Special Promotions
                    </Label>
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#130005] border border-[#D9C3C3] dark:border-white/10">
                      <Switch
                        id="discounted-filter-mellow"
                        checked={discountedOnly}
                        onCheckedChange={setDiscountedOnly}
                      />
                      <Label
                        htmlFor="discounted-filter-mellow"
                        className="text-xs font-semibold cursor-pointer text-[#130005] dark:text-white flex items-center gap-1.5"
                      >
                        <Tag className="size-3 text-[#F968AC]" />
                        Discounted Deals Only
                      </Label>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center justify-center gap-1.5 text-xs text-[#900546] hover:text-[#720336] font-bold py-1 transition-colors self-start cursor-pointer"
                    >
                      <RotateCcw className="size-3.5" />
                      Reset All Filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── 3. Active Filter Tags & Results Counter ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#130005] dark:text-white">
                Showing {filteredRooms.length} of {rooms?.length || 0} suites
              </span>
              {filteredRooms.length === 0 && (
                <span className="text-rose-600 font-medium">
                  · No matching rooms found
                </span>
              )}
            </div>

            {/* Active Tags */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2">
                {categoryFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-[#900546]/10 text-[#900546] border border-[#900546]/30 px-3 py-1 rounded-full text-xs font-semibold">
                    Category: {categoryFilter}
                    <button
                      onClick={() => setCategoryFilter("all")}
                      className="hover:text-black ml-1 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="inline-flex items-center gap-1 bg-[#900546]/10 text-[#900546] border border-[#900546]/30 px-3 py-1 rounded-full text-xs font-semibold">
                    &ldquo;{searchQuery}&rdquo;
                    <button
                      onClick={() => setSearchQuery("")}
                      className="hover:text-black ml-1 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )}
                {guestFilter !== "all" && (
                  <span className="inline-flex items-center gap-1 bg-[#900546]/10 text-[#900546] border border-[#900546]/30 px-3 py-1 rounded-full text-xs font-semibold">
                    {guestFilter}+ Guests
                    <button
                      onClick={() => setGuestFilter("all")}
                      className="hover:text-black ml-1 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )}
                {(minPrice || maxPrice) && (
                  <span className="inline-flex items-center gap-1 bg-[#900546]/10 text-[#900546] border border-[#900546]/30 px-3 py-1 rounded-full text-xs font-semibold">
                    ₱{minPrice || "0"} - ₱{maxPrice || "Any"}
                    <button
                      onClick={() => {
                        setMinPrice("");
                        setMaxPrice("");
                        setPricePreset("all");
                      }}
                      className="hover:text-black ml-1 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )}
                {discountedOnly && (
                  <span className="inline-flex items-center gap-1 bg-[#900546]/10 text-[#900546] border border-[#900546]/30 px-3 py-1 rounded-full text-xs font-semibold">
                    Special Deals
                    <button
                      onClick={() => setDiscountedOnly(false)}
                      className="hover:text-black ml-1 cursor-pointer"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                )}
                <button
                  onClick={clearFilters}
                  className="text-xs text-[#5C454B] hover:text-[#900546] underline font-semibold transition-colors cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* ── 4. Rooms Grid or Empty State ── */}
          {roomsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-3xl border border-[#D9C3C3] overflow-hidden bg-card"
                >
                  <Skeleton className="h-64 w-full" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : roomsError ? (
            <div className="text-center py-16 bg-[#FAF5F5] rounded-3xl border border-[#D9C3C3]">
              <p className="text-destructive font-semibold">
                Failed to load accommodations.
              </p>
            </div>
          ) : filteredRooms.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredRooms.map((room) => {
                const finalPrice = Math.round(
                  room.price * (1 - (room.discount || 0) / 100),
                );
                return (
                  <div
                    key={room._id}
                    className="group rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] overflow-hidden shadow-xs hover:shadow-xl hover:border-[#900546]/50 transition-all duration-500 flex flex-col justify-between"
                  >
                    <div>
                      {/* Image Frame */}
                      <div className="relative h-64 overflow-hidden bg-[#FAF5F5] dark:bg-[#25121B]">
                        {room.image ? (
                          <img
                            src={room.image}
                            alt={room.category}
                            className="size-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className="size-full flex items-center justify-center text-muted-foreground">
                            <Bed className="size-12 opacity-30 text-[#900546]" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                        {/* Top Badges */}
                        <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none">
                          {room.roomNumber ? (
                            <span className="bg-[#130005]/85 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/20">
                              Unit {room.roomNumber}
                            </span>
                          ) : (
                            <span />
                          )}

                          <span
                            className={`text-[11px] font-bold px-3 py-1 rounded-full border backdrop-blur-md ${statusBadge(room.status)}`}
                          >
                            {room.status.charAt(0).toUpperCase() +
                              room.status.slice(1)}
                          </span>
                        </div>

                        {/* Discount Ribbon */}
                        {room.discount > 0 && (
                          <div className="absolute bottom-4 left-4 bg-[#900546] text-white text-xs font-bold px-3 py-1 rounded-full shadow-md border border-[#F968AC]/40">
                            -{room.discount}% OFF
                          </div>
                        )}
                      </div>

                      {/* Content details */}
                      <div className="p-6 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-serif text-2xl font-bold text-[#130005] dark:text-white group-hover:text-[#900546] transition-colors leading-snug">
                              {room.category}
                            </h3>
                            <p className="text-xs text-[#5C454B] dark:text-gray-400 mt-1 flex items-center gap-1.5">
                              <Users className="size-3.5 text-[#618685]" />
                              Max {room.maxHead || 2} Guests
                            </p>
                          </div>

                          <div className="text-right">
                            <div className="font-serif text-2xl font-bold text-[#900546]">
                              ₱{finalPrice.toLocaleString()}
                            </div>
                            {room.discount > 0 && (
                              <div className="text-xs text-[#5C454B] dark:text-gray-400 line-through">
                                ₱{room.price.toLocaleString()}
                              </div>
                            )}
                            <span className="text-[10px] text-[#5C454B] dark:text-gray-400 block">
                              per day
                            </span>
                          </div>
                        </div>

                        {room.description && (
                          <p className="text-xs text-[#5C454B] dark:text-gray-300 line-clamp-2 leading-relaxed">
                            {room.description}
                          </p>
                        )}

                        {/* Amenities pills */}
                        {room.amenities && room.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {room.amenities.slice(0, 3).map((amenity) => (
                              <span
                                key={amenity}
                                className="inline-flex items-center text-[11px] font-medium bg-[#FAF5F5] dark:bg-[#28161D] text-[#130005] dark:text-gray-300 px-2.5 py-0.5 rounded-md border border-[#D9C3C3] dark:border-white/5"
                              >
                                {amenity}
                              </span>
                            ))}
                            {room.amenities.length > 3 && (
                              <span className="text-[10px] text-[#5C454B] dark:text-gray-400 self-center">
                                +{room.amenities.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom CTA Button */}
                    <div className="p-6 pt-0">
                      <Button
                        onClick={() => router.push(`/guest/room/${room._id}`)}
                        className="w-full bg-[#130005] hover:bg-[#900546] text-white rounded-xl h-11 text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Eye className="size-4" />
                        View Details & Reserve
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 px-4 bg-[#FAF5F5] dark:bg-[#1A0E13] rounded-3xl border border-[#D9C3C3] dark:border-white/10 space-y-4 max-w-lg mx-auto">
              <div className="size-16 rounded-2xl bg-[#900546]/10 text-[#900546] flex items-center justify-center mx-auto">
                <Filter className="size-8" />
              </div>
              <h3 className="font-serif text-2xl font-bold text-[#130005] dark:text-white">
                No Suites Match Your Filters
              </h3>
              <p className="text-xs text-[#5C454B] dark:text-gray-300 leading-relaxed">
                We couldn&apos;t find any suites matching your specific search
                criteria. Try clearing some filters or searching for another
                room category.
              </p>
              <Button
                onClick={clearFilters}
                className="bg-[#900546] hover:bg-[#720336] text-white rounded-full px-6 h-10 text-xs font-semibold shadow-md cursor-pointer"
              >
                <RotateCcw className="size-3.5 mr-2" />
                Reset All Filters
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────── */}
      {/* 7. HOTEL SERVICES & AMENITIES GRID              */}
      {/* ─────────────────────────────────────────────── */}
      <section
        id="amenities-section"
        className="py-16 lg:py-24 bg-[#E4D1D1]/20 dark:bg-[#130005] border-b border-[#D9C3C3] dark:border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3.5 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-3">
              World-Class Facilities
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#130005] dark:text-white">
              Curated Amenities & Services
            </h2>
            <p className="text-sm text-[#5C454B] dark:text-gray-300 mt-2">
              Every detail of your stay is designed with relaxation and
              indulgence in mind.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {hotelAmenities.map((amenity, idx) => {
              const Icon = amenity.icon;
              return (
                <div
                  key={idx}
                  className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-white dark:bg-[#1A0E13] p-8 shadow-xs hover:shadow-lg hover:border-[#900546]/40 transition-all duration-300 group"
                >
                  <div className="size-14 rounded-2xl bg-[#900546]/10 text-[#900546] dark:text-[#F968AC] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-[#900546] group-hover:text-white transition-all duration-300">
                    <Icon className="size-7" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#130005] dark:text-white mb-2">
                    {amenity.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#5C454B] dark:text-gray-300 leading-relaxed">
                    {amenity.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────── */}
      {/* 8. TESTIMONIALS & GUEST REVIEWS                */}
      {/* ─────────────────────────────────────────────── */}
      <section
        id="reviews-section"
        className="py-16 lg:py-24 bg-white dark:bg-[#130005] border-b border-[#D9C3C3] dark:border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3.5 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC] mb-3">
              Guest Experiences
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-normal text-[#130005] dark:text-white">
              What Our Guests Say
            </h2>
            <p className="text-sm text-[#5C454B] dark:text-gray-300 mt-2">
              Read authentic feedback from travelers who made {hotelName} their
              home.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.id}
                className="rounded-3xl border border-[#D9C3C3] dark:border-white/10 bg-[#FAF5F5] dark:bg-[#1A0E13] p-6 flex flex-col justify-between hover:shadow-lg hover:border-[#900546]/40 transition-all"
              >
                <div>
                  <div className="flex items-center gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="size-4 fill-[#F968AC] text-[#F968AC]"
                      />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-[#130005] dark:text-gray-300 italic leading-relaxed mb-6">
                    &ldquo;{t.content}&rdquo;
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-[#D9C3C3] dark:border-white/10">
                  <div className="size-9 rounded-full bg-[#900546] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    {t.avatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#130005] dark:text-white">
                      {t.name}
                    </h4>
                    <p className="text-[10px] text-[#5C454B] dark:text-gray-400">
                      {t.role}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────── */}
      {/* 9. LOCATION, CONTACT & INQUIRY FORM             */}
      {/* ─────────────────────────────────────────────── */}
      <section
        id="contact-section"
        className="py-16 lg:py-24 bg-[#E4D1D1]/30 dark:bg-[#130005] border-b border-[#D9C3C3] dark:border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="grid lg:grid-cols-12 gap-12">
            {/* Left: Contact Info & Policies */}
            <div className="lg:col-span-5 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#900546]/30 bg-[#900546]/10 px-3.5 py-1 text-xs font-semibold text-[#900546] dark:text-[#F968AC]">
                Get In Touch
              </div>
              <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#130005] dark:text-white">
                Contact Front Desk & Concierge
              </h2>
              <p className="text-sm text-[#5C454B] dark:text-gray-300 leading-relaxed">
                Have questions about room availability, group bookings, or
                special events? Our team is available 24/7 to assist.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-[#1A0E13] border border-[#D9C3C3] dark:border-white/10 shadow-xs">
                  <div className="size-10 rounded-xl bg-[#618685]/15 text-[#618685] flex items-center justify-center shrink-0">
                    <MapPin className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C454B] dark:text-gray-400">
                      Location
                    </h4>
                    <p className="text-sm font-medium text-[#130005] dark:text-white mt-0.5">
                      Jose D. Aspiras Hwy, Tubao, 2506 La Union, Philippines
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-[#1A0E13] border border-[#D9C3C3] dark:border-white/10 shadow-xs">
                  <div className="size-10 rounded-xl bg-[#618685]/15 text-[#618685] flex items-center justify-center shrink-0">
                    <Clock className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C454B] dark:text-gray-400">
                      Check-in & Check-out
                    </h4>
                    <p className="text-sm font-medium text-[#130005] dark:text-white mt-0.5">
                      Flexible Anytime Check-in & Check-out (24/7 Front Desk)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white dark:bg-[#1A0E13] border border-[#D9C3C3] dark:border-white/10 shadow-xs">
                  <div className="size-10 rounded-xl bg-[#618685]/15 text-[#618685] flex items-center justify-center shrink-0">
                    <CreditCard className="size-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#5C454B] dark:text-gray-400">
                      Payment Methods
                    </h4>
                    <p className="text-sm font-medium text-[#130005] dark:text-white mt-0.5">
                      Cash · GCash · Online Payment
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Message Form */}
            <div className="lg:col-span-7">
              <div className="bg-white dark:bg-[#1A0E13] rounded-3xl p-8 sm:p-10 shadow-lg border border-[#D9C3C3] dark:border-white/10">
                <h3 className="font-serif text-2xl font-bold text-[#130005] dark:text-white mb-2">
                  Send A Direct Inquiry
                </h3>
                <p className="text-xs text-[#5C454B] dark:text-gray-400 mb-6">
                  Fill in your details and our front-desk reception will get
                  back to you promptly.
                </p>

                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#5C454B] dark:text-gray-300">
                        Your Name *
                      </Label>
                      <Input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="John Doe"
                        className="h-11 bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 rounded-xl text-xs focus-visible:ring-[#900546]"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#5C454B] dark:text-gray-300">
                        Email Address *
                      </Label>
                      <Input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="h-11 bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 rounded-xl text-xs focus-visible:ring-[#900546]"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#5C454B] dark:text-gray-300">
                      Subject
                    </Label>
                    <Input
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="Room inquiry, special dates, or event"
                      className="h-11 bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 rounded-xl text-xs focus-visible:ring-[#900546]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-[#5C454B] dark:text-gray-300">
                      Message *
                    </Label>
                    <Textarea
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Tell us how we can assist you with your stay..."
                      rows={4}
                      className="bg-[#FAF5F5] dark:bg-[#28161D] border-[#D9C3C3] dark:border-white/10 rounded-xl text-xs focus-visible:ring-[#900546]"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={sendingContact}
                    className="w-full bg-[#900546] hover:bg-[#720336] text-white rounded-xl h-12 text-sm font-semibold shadow-lg shadow-[#900546]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {sendingContact ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Sending Inquiry...
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        Send Message to Us
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>

          {/* ── Interactive GPS Leaflet Map & Directions ── */}
          <div className="mt-12">
            <HotelLocationMap hotelName={hotelName} />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────── */}
      {/* 10. LUXURY FOOTER (Florentina Style)            */}
      {/* ─────────────────────────────────────────────── */}
      <footer className="bg-[#130005] text-white py-12 px-4 sm:px-8 border-t border-[#900546]/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 pb-10 border-b border-white/10">
            {/* Brand column */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-xl overflow-hidden bg-white p-1 border border-white/10 flex items-center justify-center shadow-xs">
                  <img
                    src={logoUrl}
                    alt={hotelName}
                    className="size-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "/Florentina Inn Logo.png";
                    }}
                  />
                </div>
                <div>
                  <span className="font-serif text-2xl font-bold tracking-tight text-white block">
                    {hotelName}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#F968AC] font-semibold block">
                    Comfort & Affordable Accommodations
                  </span>
                </div>
              </div>
              <p className="text-xs text-[#E4D1D1]/70 leading-relaxed max-w-xs">
                Your premier destination for serenity, luxury comfort, and
                world-class hospitality in Tubao, La Union.
              </p>
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-[#F968AC]">
                Explore
              </h4>
              <ul className="space-y-2 text-xs text-[#E4D1D1]/80">
                <li>
                  <Link
                    href="/guest/reservationStatus"
                    className="hover:text-[#F968AC] transition-colors cursor-pointer"
                  >
                    Check Reservation Status
                  </Link>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection("hero-section")}
                    className="hover:text-[#F968AC] transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection("rooms-section")}
                    className="hover:text-[#F968AC] transition-colors cursor-pointer"
                  >
                    Rooms & Suites
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection("amenities-section")}
                    className="hover:text-[#F968AC] transition-colors cursor-pointer"
                  >
                    Hotel Amenities
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection("about-section")}
                    className="hover:text-[#F968AC] transition-colors cursor-pointer"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => scrollToSection("contact-section")}
                    className="hover:text-[#F968AC] transition-colors cursor-pointer"
                  >
                    Contact & Inquiries
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact & Front Desk Info */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase tracking-wider font-semibold text-[#F968AC]">
                Location & Reception
              </h4>
              <p className="text-xs text-[#E4D1D1]/80 flex items-start gap-1.5">
                <MapPin className="size-3.5 text-[#618685] shrink-0 mt-0.5" />
                <span>Francia Sur, Jose D. Aspiras Hwy, Tubao, La Union</span>
              </p>
              <p className="text-xs text-[#E4D1D1]/80 flex items-center gap-1.5">
                <Clock className="size-3.5 text-[#618685] shrink-0" />
                <span>24/7 Front-Desk & Concierge Service</span>
              </p>
              <p className="text-xs text-[#E4D1D1]/60 pt-1">
                For urgent inquiries or booking assistance, our reception is
                open around the clock.
              </p>
            </div>
          </div>

          {/* Bottom copyright */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#E4D1D1]/50">
            <p>
              &copy; {new Date().getFullYear()} {hotelName}. All rights
              reserved.
            </p>
            <p className="flex items-center gap-2">
              <span className="text-[#F968AC]">
                Crafted for Serenity & Luxury Hospitality
              </span>
            </p>
          </div>

          {systemInfo?.facebook && (
            <div className="pt-6 flex justify-center">
              <a
                href={systemInfo.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-[#900546] hover:border-[#900546] transition-colors cursor-pointer"
                title="Follow us on Facebook"
              >
                <FacebookIcon size={14} />
                Follow us on Facebook
              </a>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
