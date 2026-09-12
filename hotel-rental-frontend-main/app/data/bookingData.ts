import { bookingInterface } from "../types/bookings.type";

const standardSingle = { _id: "room_001", category: "Standard Single", amenities: ["WiFi", "TV", "Air Conditioning"], price: 1500, discount: 0, image: "/rooms/standard-single.jpg", description: "Cozy single room with essential amenities", images: [], status: "available", maintenance: "none", housekeeping: ["daily"], maxHead: 1 };
const standardDouble = { _id: "room_002", category: "Standard Double", amenities: ["WiFi", "TV", "Air Conditioning", "Mini Bar"], price: 2200, discount: 10, image: "/rooms/standard-double.jpg", description: "Spacious double room with mini bar", images: [], status: "available", maintenance: "none", housekeeping: ["daily"], maxHead: 2 };
const deluxeSuite = { _id: "room_003", category: "Deluxe Suite", amenities: ["WiFi", "TV", "Air Conditioning", "Jacuzzi", "Balcony", "Mini Bar"], price: 4500, discount: 15, image: "/rooms/deluxe-suite.jpg", description: "Luxurious suite with jacuzzi and balcony", images: [], status: "available", maintenance: "none", housekeeping: ["daily", "turndown"], maxHead: 3 };
const familyRoom = { _id: "room_004", category: "Family Room", amenities: ["WiFi", "TV", "Air Conditioning", "Kitchenette", "Play Area"], price: 3500, discount: 5, image: "/rooms/family-room.jpg", description: "Perfect for families with kitchenette", images: [], status: "available", maintenance: "none", housekeeping: ["daily"], maxHead: 5 };
const penthouse = { _id: "room_005", category: "Penthouse", amenities: ["WiFi", "TV", "Air Conditioning", "Jacuzzi", "Balcony", "Mini Bar", "Butler Service"], price: 8500, discount: 20, image: "/rooms/penthouse.jpg", description: "Top-floor luxury with panoramic views", images: [], status: "available", maintenance: "none", housekeeping: ["daily", "turndown", "concierge"], maxHead: 4 };
const executiveSuite = { _id: "room_006", category: "Executive Suite", amenities: ["WiFi", "TV", "Air Conditioning", "Meeting Room", "Coffee Machine", "Lounge Access"], price: 5500, discount: 10, image: "/rooms/executive.jpg", description: "Business-class suite with lounge access", images: [], status: "available", maintenance: "none", housekeeping: ["daily", "turndown"], maxHead: 2 };

export const bookingData: bookingInterface[] = [
  // ===== 2024 JANUARY (off-peak) =====
  { _id: "bk_0001", clientName: "Juan Santos", clientAddress: "123 Manila St., Manila City", type: "online", status: "checked-out", arrivalDate: "2024-01-05", arrivalTime: "14:00", room: standardSingle },
  { _id: "bk_0002", clientName: "Maria Cruz", clientAddress: "456 Quezon Ave., Quezon City", type: "walk-in", status: "checked-out", arrivalDate: "2024-01-12", arrivalTime: "11:30", room: standardDouble },
  { _id: "bk_0003", clientName: "Jose Reyes", clientAddress: "789 Makati St., Makati City", type: "corporate", status: "checked-out", arrivalDate: "2024-01-20", arrivalTime: "15:00", room: deluxeSuite },

  // ===== 2024 FEBRUARY (off-peak) =====
  { _id: "bk_0004", clientName: "Ana Villanueva", clientAddress: "321 Cebu Rd., Cebu City", type: "online", status: "checked-out", arrivalDate: "2024-02-08", arrivalTime: "13:00", room: familyRoom },
  { _id: "bk_0005", clientName: "Carlos Mendoza", clientAddress: "654 Davao Blvd., Davao City", type: "walk-in", status: "checked-out", arrivalDate: "2024-02-18", arrivalTime: "10:45", room: standardSingle },

  // ===== 2024 MARCH (spring peak) =====
  { _id: "bk_0006", clientName: "Luisa Garcia", clientAddress: "987 Baguio St., Baguio City", type: "online", status: "checked-out", arrivalDate: "2024-03-01", arrivalTime: "14:30", room: standardDouble },
  { _id: "bk_0007", clientName: "Antonio Lopez", clientAddress: "147 Tagaytay Ave., Tagaytay City", type: "phone", status: "checked-out", arrivalDate: "2024-03-05", arrivalTime: "12:00", room: deluxeSuite },
  { _id: "bk_0008", clientName: "Elena Torres", clientAddress: "258 Boracay St., Boracay", type: "online", status: "checked-out", arrivalDate: "2024-03-10", arrivalTime: "16:00", room: penthouse },
  { _id: "bk_0009", clientName: "Manuel Rivera", clientAddress: "369 Palawan Rd., Palawan", type: "corporate", status: "checked-out", arrivalDate: "2024-03-15", arrivalTime: "09:30", room: executiveSuite },
  { _id: "bk_0010", clientName: "Rosa Fernandez", clientAddress: "741 Batangas St., Batangas City", type: "walk-in", status: "checked-out", arrivalDate: "2024-03-22", arrivalTime: "11:15", room: familyRoom },

  // ===== 2024 APRIL (spring peak) =====
  { _id: "bk_0011", clientName: "Pedro Gonzalez", clientAddress: "852 Laguna Blvd., Laguna", type: "online", status: "checked-out", arrivalDate: "2024-04-02", arrivalTime: "14:00", room: standardSingle },
  { _id: "bk_0012", clientName: "Carmen Ramirez", clientAddress: "963 Cavite St., Cavite City", type: "agent", status: "checked-out", arrivalDate: "2024-04-07", arrivalTime: "15:30", room: standardDouble },
  { _id: "bk_0013", clientName: "Miguel Martinez", clientAddress: "159 Iloilo Ave., Iloilo City", type: "online", status: "checked-out", arrivalDate: "2024-04-12", arrivalTime: "10:00", room: deluxeSuite },
  { _id: "bk_0014", clientName: "Isabel Rodriguez", clientAddress: "753 Zamboanga St., Zamboanga City", type: "walk-in", status: "checked-out", arrivalDate: "2024-04-18", arrivalTime: "13:45", room: familyRoom },
  { _id: "bk_0015", clientName: "Francisco Dela Cruz", clientAddress: "426 Bacolod Rd., Bacolod City", type: "corporate", status: "checked-out", arrivalDate: "2024-04-25", arrivalTime: "11:00", room: standardDouble },

  // ===== 2024 MAY (spring peak) =====
  { _id: "bk_0016", clientName: "Teresa Bautista", clientAddress: "837 Butuan St., Butuan City", type: "phone", status: "checked-out", arrivalDate: "2024-05-01", arrivalTime: "14:30", room: deluxeSuite },
  { _id: "bk_0017", clientName: "Jorge Aquino", clientAddress: "294 Manila St., Manila City", type: "online", status: "checked-out", arrivalDate: "2024-05-06", arrivalTime: "16:00", room: penthouse },
  { _id: "bk_0018", clientName: "Sofia Ramos", clientAddress: "583 Quezon Ave., Quezon City", type: "walk-in", status: "checked-out", arrivalDate: "2024-05-11", arrivalTime: "12:15", room: standardSingle },
  { _id: "bk_0019", clientName: "Luis Castillo", clientAddress: "761 Makati St., Makati City", type: "corporate", status: "checked-out", arrivalDate: "2024-05-17", arrivalTime: "09:45", room: executiveSuite },
  { _id: "bk_0020", clientName: "Patricia Gomez", clientAddress: "348 Cebu Rd., Cebu City", type: "online", status: "checked-out", arrivalDate: "2024-05-24", arrivalTime: "15:00", room: familyRoom },

  // ===== 2024 JUNE (summer peak) =====
  { _id: "bk_0021", clientName: "Ramon Diaz", clientAddress: "672 Davao Blvd., Davao City", type: "agent", status: "checked-out", arrivalDate: "2024-06-03", arrivalTime: "11:30", room: standardDouble },
  { _id: "bk_0022", clientName: "Monica Flores", clientAddress: "915 Baguio St., Baguio City", type: "online", status: "checked-out", arrivalDate: "2024-06-08", arrivalTime: "14:00", room: deluxeSuite },
  { _id: "bk_0023", clientName: "Diego Morales", clientAddress: "238 Tagaytay Ave., Tagaytay City", type: "walk-in", status: "checked-out", arrivalDate: "2024-06-14", arrivalTime: "13:00", room: standardSingle },
  { _id: "bk_0024", clientName: "Claudia Navarro", clientAddress: "547 Boracay St., Boracay", type: "phone", status: "checked-out", arrivalDate: "2024-06-20", arrivalTime: "10:30", room: penthouse },
  { _id: "bk_0025", clientName: "Fernando Padilla", clientAddress: "893 Palawan Rd., Palawan", type: "online", status: "checked-out", arrivalDate: "2024-06-28", arrivalTime: "15:45", room: standardDouble },

  // ===== 2024 JULY (summer peak) =====
  { _id: "bk_0026", clientName: "Gloria Soriano", clientAddress: "176 Batangas St., Batangas City", type: "corporate", status: "checked-out", arrivalDate: "2024-07-02", arrivalTime: "14:30", room: executiveSuite },
  { _id: "bk_0027", clientName: "Andres Valdez", clientAddress: "524 Laguna Blvd., Laguna", type: "walk-in", status: "checked-out", arrivalDate: "2024-07-09", arrivalTime: "12:00", room: familyRoom },
  { _id: "bk_0028", clientName: "Veronica Alcantara", clientAddress: "869 Cavite St., Cavite City", type: "online", status: "checked-out", arrivalDate: "2024-07-15", arrivalTime: "16:00", room: deluxeSuite },
  { _id: "bk_0029", clientName: "Sergio Barcelona", clientAddress: "413 Iloilo Ave., Iloilo City", type: "agent", status: "checked-out", arrivalDate: "2024-07-22", arrivalTime: "09:30", room: standardSingle },

  // ===== 2024 AUGUST (summer peak) =====
  { _id: "bk_0030", clientName: "Adriana Cordova", clientAddress: "657 Zamboanga St., Zamboanga City", type: "online", status: "checked-out", arrivalDate: "2024-08-01", arrivalTime: "11:15", room: standardDouble },
  { _id: "bk_0031", clientName: "Pablo Domingo", clientAddress: "382 Bacolod Rd., Bacolod City", type: "walk-in", status: "checked-out", arrivalDate: "2024-08-07", arrivalTime: "14:45", room: deluxeSuite },
  { _id: "bk_0032", clientName: "Beatriz Estrada", clientAddress: "194 Butuan St., Butuan City", type: "phone", status: "checked-out", arrivalDate: "2024-08-13", arrivalTime: "10:00", room: penthouse },
  { _id: "bk_0033", clientName: "Marco Ferrer", clientAddress: "738 Manila St., Manila City", type: "corporate", status: "checked-out", arrivalDate: "2024-08-20", arrivalTime: "15:30", room: executiveSuite },

  // ===== 2024 SEPTEMBER (off-peak) =====
  { _id: "bk_0034", clientName: "Diana Gutierrez", clientAddress: "521 Quezon Ave., Quezon City", type: "online", status: "checked-out", arrivalDate: "2024-09-04", arrivalTime: "13:00", room: standardSingle },
  { _id: "bk_0035", clientName: "Alberto Hernandez", clientAddress: "369 Makati St., Makati City", type: "walk-in", status: "checked-out", arrivalDate: "2024-09-11", arrivalTime: "11:30", room: familyRoom },
  { _id: "bk_0036", clientName: "Margarita Ibañez", clientAddress: "147 Cebu Rd., Cebu City", type: "agent", status: "checked-out", arrivalDate: "2024-09-22", arrivalTime: "14:00", room: standardDouble },

  // ===== 2024 OCTOBER (holiday ramp-up) =====
  { _id: "bk_0037", clientName: "Rafael Jimenez", clientAddress: "852 Davao Blvd., Davao City", type: "online", status: "checked-out", arrivalDate: "2024-10-03", arrivalTime: "15:00", room: deluxeSuite },
  { _id: "bk_0038", clientName: "Alicia Kintanar", clientAddress: "963 Baguio St., Baguio City", type: "corporate", status: "checked-out", arrivalDate: "2024-10-08", arrivalTime: "09:45", room: executiveSuite },
  { _id: "bk_0039", clientName: "Victor Lim", clientAddress: "284 Tagaytay Ave., Tagaytay City", type: "walk-in", status: "checked-out", arrivalDate: "2024-10-14", arrivalTime: "12:30", room: standardSingle },
  { _id: "bk_0040", clientName: "Silvia Magsaysay", clientAddress: "571 Boracay St., Boracay", type: "phone", status: "checked-out", arrivalDate: "2024-10-19", arrivalTime: "16:00", room: penthouse },
  { _id: "bk_0041", clientName: "Oscar Nieto", clientAddress: "839 Palawan Rd., Palawan", type: "online", status: "checked-out", arrivalDate: "2024-10-26", arrivalTime: "14:15", room: standardDouble },

  // ===== 2024 NOVEMBER (holiday ramp-up) =====
  { _id: "bk_0042", clientName: "Lourdes Ortega", clientAddress: "416 Batangas St., Batangas City", type: "agent", status: "checked-out", arrivalDate: "2024-11-02", arrivalTime: "11:00", room: familyRoom },
  { _id: "bk_0043", clientName: "Enrique Pascual", clientAddress: "738 Laguna Blvd., Laguna", type: "online", status: "checked-out", arrivalDate: "2024-11-08", arrivalTime: "13:30", room: deluxeSuite },
  { _id: "bk_0044", clientName: "Leticia Quezon", clientAddress: "295 Cavite St., Cavite City", type: "walk-in", status: "checked-out", arrivalDate: "2024-11-15", arrivalTime: "10:15", room: standardSingle },
  { _id: "bk_0045", clientName: "Ricardo Resurreccion", clientAddress: "624 Iloilo Ave., Iloilo City", type: "corporate", status: "checked-out", arrivalDate: "2024-11-22", arrivalTime: "15:45", room: executiveSuite },

  // ===== 2024 DECEMBER (holiday peak) =====
  { _id: "bk_0046", clientName: "Cristina Saludo", clientAddress: "173 Zamboanga St., Zamboanga City", type: "online", status: "checked-out", arrivalDate: "2024-12-01", arrivalTime: "14:00", room: penthouse },
  { _id: "bk_0047", clientName: "David Tolentino", clientAddress: "862 Bacolod Rd., Bacolod City", type: "phone", status: "checked-out", arrivalDate: "2024-12-05", arrivalTime: "12:00", room: deluxeSuite },
  { _id: "bk_0048", clientName: "Alejandra Uy", clientAddress: "491 Butuan St., Butuan City", type: "walk-in", status: "checked-out", arrivalDate: "2024-12-08", arrivalTime: "16:30", room: standardDouble },
  { _id: "bk_0049", clientName: "Raul Velasco", clientAddress: "537 Manila St., Manila City", type: "online", status: "checked-out", arrivalDate: "2024-12-12", arrivalTime: "11:00", room: familyRoom },
  { _id: "bk_0050", clientName: "Sara Santos", clientAddress: "948 Quezon Ave., Quezon City", type: "agent", status: "checked-out", arrivalDate: "2024-12-16", arrivalTime: "10:30", room: executiveSuite },
  { _id: "bk_0051", clientName: "Juan Cruz", clientAddress: "162 Makati St., Makati City", type: "walk-in", status: "checked-out", arrivalDate: "2024-12-19", arrivalTime: "14:45", room: standardSingle },
  { _id: "bk_0052", clientName: "Maria Garcia", clientAddress: "784 Cebu Rd., Cebu City", type: "online", status: "checked-out", arrivalDate: "2024-12-22", arrivalTime: "15:15", room: deluxeSuite },
  { _id: "bk_0053", clientName: "Jose Reyes", clientAddress: "396 Davao Blvd., Davao City", type: "corporate", status: "checked-out", arrivalDate: "2024-12-27", arrivalTime: "13:00", room: penthouse },

  // ===== 2025 JANUARY (off-peak) =====
  { _id: "bk_0054", clientName: "Ana Mendoza", clientAddress: "215 Baguio St., Baguio City", type: "online", status: "checked-out", arrivalDate: "2025-01-04", arrivalTime: "14:00", room: standardSingle },
  { _id: "bk_0055", clientName: "Carlos Lopez", clientAddress: "634 Tagaytay Ave., Tagaytay City", type: "walk-in", status: "checked-out", arrivalDate: "2025-01-11", arrivalTime: "11:30", room: standardDouble },
  { _id: "bk_0056", clientName: "Luisa Villanueva", clientAddress: "873 Boracay St., Boracay", type: "phone", status: "checked-out", arrivalDate: "2025-01-19", arrivalTime: "15:00", room: deluxeSuite },

  // ===== 2025 FEBRUARY (off-peak) =====
  { _id: "bk_0057", clientName: "Antonio Rivera", clientAddress: "128 Palawan Rd., Palawan", type: "corporate", status: "checked-out", arrivalDate: "2025-02-07", arrivalTime: "10:00", room: executiveSuite },
  { _id: "bk_0058", clientName: "Elena Torres", clientAddress: "596 Batangas St., Batangas City", type: "online", status: "checked-out", arrivalDate: "2025-02-16", arrivalTime: "13:30", room: familyRoom },

  // ===== 2025 MARCH (spring peak) =====
  { _id: "bk_0059", clientName: "Manuel Fernandez", clientAddress: "347 Laguna Blvd., Laguna", type: "agent", status: "checked-out", arrivalDate: "2025-03-02", arrivalTime: "14:45", room: standardDouble },
  { _id: "bk_0060", clientName: "Rosa Gonzalez", clientAddress: "759 Cavite St., Cavite City", type: "online", status: "checked-out", arrivalDate: "2025-03-06", arrivalTime: "12:00", room: deluxeSuite },
  { _id: "bk_0061", clientName: "Pedro Ramirez", clientAddress: "482 Iloilo Ave., Iloilo City", type: "walk-in", status: "checked-out", arrivalDate: "2025-03-11", arrivalTime: "09:30", room: penthouse },
  { _id: "bk_0062", clientName: "Carmen Martinez", clientAddress: "826 Zamboanga St., Zamboanga City", type: "phone", status: "checked-out", arrivalDate: "2025-03-17", arrivalTime: "15:30", room: executiveSuite },
  { _id: "bk_0063", clientName: "Miguel Rodriguez", clientAddress: "193 Bacolod Rd., Bacolod City", type: "corporate", status: "checked-out", arrivalDate: "2025-03-24", arrivalTime: "11:00", room: standardSingle },

  // ===== 2025 APRIL (spring peak) =====
  { _id: "bk_0064", clientName: "Isabel Dela Cruz", clientAddress: "567 Butuan St., Butuan City", type: "online", status: "checked-out", arrivalDate: "2025-04-01", arrivalTime: "14:00", room: familyRoom },
  { _id: "bk_0065", clientName: "Francisco Bautista", clientAddress: "841 Manila St., Manila City", type: "walk-in", status: "checked-out", arrivalDate: "2025-04-05", arrivalTime: "13:15", room: standardDouble },
  { _id: "bk_0066", clientName: "Teresa Aquino", clientAddress: "325 Quezon Ave., Quezon City", type: "agent", status: "checked-out", arrivalDate: "2025-04-10", arrivalTime: "16:00", room: deluxeSuite },
  { _id: "bk_0067", clientName: "Jorge Ramos", clientAddress: "498 Makati St., Makati City", type: "online", status: "checked-out", arrivalDate: "2025-04-19", arrivalTime: "10:30", room: standardSingle },

  // ===== 2025 MAY (spring peak) =====
  { _id: "bk_0068", clientName: "Sofia Castillo", clientAddress: "174 Cebu Rd., Cebu City", type: "corporate", status: "checked-out", arrivalDate: "2025-05-03", arrivalTime: "11:45", room: executiveSuite },
  { _id: "bk_0069", clientName: "Luis Gomez", clientAddress: "623 Davao Blvd., Davao City", type: "phone", status: "checked-out", arrivalDate: "2025-05-08", arrivalTime: "14:30", room: penthouse },
  { _id: "bk_0070", clientName: "Patricia Diaz", clientAddress: "947 Baguio St., Baguio City", type: "online", status: "checked-out", arrivalDate: "2025-05-13", arrivalTime: "12:00", room: standardDouble },
  { _id: "bk_0071", clientName: "Ramon Flores", clientAddress: "136 Tagaytay Ave., Tagaytay City", type: "walk-in", status: "checked-out", arrivalDate: "2025-05-18", arrivalTime: "15:15", room: familyRoom },
  { _id: "bk_0072", clientName: "Monica Morales", clientAddress: "852 Boracay St., Boracay", type: "agent", status: "confirmed", arrivalDate: "2025-05-25", arrivalTime: "09:00", room: deluxeSuite },

  // ===== 2025 JUNE (summer peak) =====
  { _id: "bk_0073", clientName: "Diego Navarro", clientAddress: "419 Palawan Rd., Palawan", type: "online", status: "checked-in", arrivalDate: "2025-06-01", arrivalTime: "14:00", room: standardSingle },
  { _id: "bk_0074", clientName: "Claudia Padilla", clientAddress: "764 Batangas St., Batangas City", type: "corporate", status: "checked-in", arrivalDate: "2025-06-06", arrivalTime: "13:00", room: executiveSuite },
  { _id: "bk_0075", clientName: "Fernando Soriano", clientAddress: "287 Laguna Blvd., Laguna", type: "walk-in", status: "checked-in", arrivalDate: "2025-06-12", arrivalTime: "11:30", room: standardDouble },
  { _id: "bk_0076", clientName: "Gloria Valdez", clientAddress: "538 Cavite St., Cavite City", type: "phone", status: "confirmed", arrivalDate: "2025-06-21", arrivalTime: "15:00", room: deluxeSuite },

  // ===== 2025 JULY (summer peak) =====
  { _id: "bk_0077", clientName: "Andres Alcantara", clientAddress: "195 Iloilo Ave., Iloilo City", type: "online", status: "checked-in", arrivalDate: "2025-07-03", arrivalTime: "12:45", room: penthouse },
  { _id: "bk_0078", clientName: "Veronica Barcelona", clientAddress: "472 Zamboanga St., Zamboanga City", type: "agent", status: "confirmed", arrivalDate: "2025-07-09", arrivalTime: "10:00", room: familyRoom },
  { _id: "bk_0079", clientName: "Sergio Cordova", clientAddress: "829 Bacolod Rd., Bacolod City", type: "walk-in", status: "confirmed", arrivalDate: "2025-07-16", arrivalTime: "14:30", room: standardSingle },
  { _id: "bk_0080", clientName: "Adriana Domingo", clientAddress: "361 Butuan St., Butuan City", type: "online", status: "confirmed", arrivalDate: "2025-07-23", arrivalTime: "16:00", room: standardDouble },

  // ===== 2025 AUGUST (summer peak) =====
  { _id: "bk_0081", clientName: "Pablo Estrada", clientAddress: "614 Manila St., Manila City", type: "corporate", status: "confirmed", arrivalDate: "2025-08-02", arrivalTime: "09:30", room: executiveSuite },
  { _id: "bk_0082", clientName: "Beatriz Ferrer", clientAddress: "283 Quezon Ave., Quezon City", type: "online", status: "confirmed", arrivalDate: "2025-08-08", arrivalTime: "13:45", room: deluxeSuite },
  { _id: "bk_0083", clientName: "Marco Gutierrez", clientAddress: "736 Makati St., Makati City", type: "phone", status: "confirmed", arrivalDate: "2025-08-14", arrivalTime: "11:00", room: standardDouble },
  { _id: "bk_0084", clientName: "Diana Hernandez", clientAddress: "519 Cebu Rd., Cebu City", type: "walk-in", status: "confirmed", arrivalDate: "2025-08-22", arrivalTime: "15:15", room: familyRoom },

  // ===== 2025 SEPTEMBER (off-peak) =====
  { _id: "bk_0085", clientName: "Alberto Ibañez", clientAddress: "847 Davao Blvd., Davao City", type: "agent", status: "confirmed", arrivalDate: "2025-09-05", arrivalTime: "14:00", room: standardSingle },
  { _id: "bk_0086", clientName: "Margarita Jimenez", clientAddress: "362 Baguio St., Baguio City", type: "online", status: "confirmed", arrivalDate: "2025-09-13", arrivalTime: "12:30", room: deluxeSuite },
  { _id: "bk_0087", clientName: "Rafael Kintanar", clientAddress: "718 Tagaytay Ave., Tagaytay City", type: "walk-in", status: "confirmed", arrivalDate: "2025-09-21", arrivalTime: "10:00", room: standardDouble },

  // ===== 2025 OCTOBER (holiday ramp-up) =====
  { _id: "bk_0088", clientName: "Alicia Lim", clientAddress: "539 Boracay St., Boracay", type: "corporate", status: "confirmed", arrivalDate: "2025-10-02", arrivalTime: "15:30", room: executiveSuite },
  { _id: "bk_0089", clientName: "Victor Magsaysay", clientAddress: "184 Palawan Rd., Palawan", type: "online", status: "confirmed", arrivalDate: "2025-10-07", arrivalTime: "11:15", room: penthouse },
  { _id: "bk_0090", clientName: "Silvia Nieto", clientAddress: "476 Batangas St., Batangas City", type: "phone", status: "confirmed", arrivalDate: "2025-10-13", arrivalTime: "14:45", room: standardSingle },
  { _id: "bk_0091", clientName: "Oscar Ortega", clientAddress: "823 Laguna Blvd., Laguna", type: "walk-in", status: "confirmed", arrivalDate: "2025-10-20", arrivalTime: "09:00", room: deluxeSuite },

  // ===== 2025 NOVEMBER (holiday ramp-up) =====
  { _id: "bk_0092", clientName: "Lourdes Pascual", clientAddress: "251 Cavite St., Cavite City", type: "agent", status: "confirmed", arrivalDate: "2025-11-01", arrivalTime: "13:00", room: familyRoom },
  { _id: "bk_0093", clientName: "Enrique Quezon", clientAddress: "684 Iloilo Ave., Iloilo City", type: "online", status: "confirmed", arrivalDate: "2025-11-08", arrivalTime: "10:30", room: standardDouble },
  { _id: "bk_0094", clientName: "Leticia Resurreccion", clientAddress: "317 Zamboanga St., Zamboanga City", type: "corporate", status: "confirmed", arrivalDate: "2025-11-15", arrivalTime: "15:00", room: executiveSuite },
  { _id: "bk_0095", clientName: "Ricardo Saludo", clientAddress: "596 Bacolod Rd., Bacolod City", type: "walk-in", status: "confirmed", arrivalDate: "2025-11-22", arrivalTime: "12:00", room: deluxeSuite },

  // ===== 2025 DECEMBER (holiday peak) =====
  { _id: "bk_0096", clientName: "Cristina Tolentino", clientAddress: "149 Butuan St., Butuan City", type: "online", status: "confirmed", arrivalDate: "2025-12-03", arrivalTime: "14:00", room: penthouse },
  { _id: "bk_0097", clientName: "David Uy", clientAddress: "728 Manila St., Manila City", type: "phone", status: "confirmed", arrivalDate: "2025-12-06", arrivalTime: "11:30", room: deluxeSuite },
  { _id: "bk_0098", clientName: "Alejandra Velasco", clientAddress: "362 Quezon Ave., Quezon City", type: "agent", status: "confirmed", arrivalDate: "2025-12-10", arrivalTime: "15:45", room: standardDouble },
  { _id: "bk_0099", clientName: "Raul Santos", clientAddress: "815 Makati St., Makati City", type: "online", status: "confirmed", arrivalDate: "2025-12-15", arrivalTime: "10:15", room: familyRoom },
  { _id: "bk_0100", clientName: "Sara Cruz", clientAddress: "473 Cebu Rd., Cebu City", type: "walk-in", status: "confirmed", arrivalDate: "2025-12-19", arrivalTime: "13:00", room: executiveSuite },
  { _id: "bk_0101", clientName: "Juan Garcia", clientAddress: "926 Davao Blvd., Davao City", type: "corporate", status: "confirmed", arrivalDate: "2025-12-22", arrivalTime: "16:00", room: deluxeSuite },
  { _id: "bk_0102", clientName: "Maria Reyes", clientAddress: "182 Baguio St., Baguio City", type: "online", status: "confirmed", arrivalDate: "2025-12-27", arrivalTime: "12:00", room: penthouse },
];
