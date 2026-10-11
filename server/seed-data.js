// Wipe existing bookings/payments and seed a demo dataset of 20 stays for
// Jan-Aug 2026 (confirmed reservations + checked-in only, no pending/unpaid).
// Usage: node seed-data.js   (run from the backend folder)
const mongoose = require("mongoose");
const BookingsModel = require("./dist/model/bookings.model").default;
const RoomModel = require("./dist/model/room.model").default;
const PaymentModel = require("./dist/model/payment.model").default;

const PRICE = { "1": 1800, "2": 2200, "3": 1600, "4": 1800 };

function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function shift(s, days) {
  const d = parseDate(s);
  d.setDate(d.getDate() + days);
  return dateStr(d);
}
function nightsBetween(arrival, departure) {
  return Math.round((parseDate(departure) - parseDate(arrival)) / 86400000);
}

// order: room, arrival, departure, client, type, status
// status: completed (historical, checked-out) | reservation (confirmed & paid)
const DATA = [
  ["1", "2026-01-02", "2026-01-05", "Amelia Cruz", "walk-in", "completed"],
  ["2", "2026-01-12", "2026-01-17", "Bruno Santos", "reservation", "reservation"],
  ["3", "2026-01-21", "2026-01-28", "Carla Reyes", "walk-in", "completed"],

  ["4", "2026-02-01", "2026-02-05", "Daniel Lim", "reservation", "reservation"],
  ["1", "2026-02-10", "2026-02-13", "Erica Mendoza", "walk-in", "completed"],
  ["2", "2026-02-19", "2026-02-24", "Fernando Diaz", "reservation", "reservation"],

  ["3", "2026-03-02", "2026-03-08", "Gina Navarro", "walk-in", "completed"],
  ["4", "2026-03-11", "2026-03-14", "Hector Aguilar", "reservation", "reservation"],
  ["1", "2026-03-20", "2026-03-26", "Ivy Bautista", "walk-in", "completed"],

  ["2", "2026-04-01", "2026-04-05", "Jose Villanueva", "reservation", "reservation"],
  ["3", "2026-04-10", "2026-04-16", "Kathy Lopez", "walk-in", "completed"],
  ["4", "2026-04-19", "2026-04-22", "Lito Fernandez", "reservation", "reservation"],

  ["1", "2026-05-01", "2026-05-08", "Mae Garcia", "walk-in", "completed"],
  ["2", "2026-05-12", "2026-05-15", "Noel Salazar", "reservation", "reservation"],
  ["3", "2026-05-21", "2026-05-26", "Oscar Domingo", "walk-in", "completed"],

  ["4", "2026-06-03", "2026-06-10", "Pia Co", "reservation", "reservation"],
  ["1", "2026-06-13", "2026-06-16", "Queenie Ramos", "walk-in", "completed"],

  ["2", "2026-07-05", "2026-07-12", "Ramon Tan", "reservation", "reservation"],
  ["3", "2026-07-15", "2026-07-18", "Sandra Uy", "walk-in", "completed"],

  ["4", "2026-08-04", "2026-08-11", "Tomas Yap", "reservation", "reservation"],
];

(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/rental-management");

  // ── 1. Delete old data ──
  const oldB = await BookingsModel.deleteMany({});
  const oldP = await PaymentModel.deleteMany({});
  console.log(`Removed old data: ${oldB.deletedCount} bookings, ${oldP.deletedCount} payments`);

  // ── 2. Seed bookings + payments ──
  const rooms = {};
  for (const num of Object.keys(PRICE)) {
    rooms[num] = await RoomModel.findOne({ roomNumber: num });
    if (!rooms[num]) throw new Error(`Room ${num} not found`);
  }

  let count = 0;
  for (const [num, arrival, departure, client, type, status] of DATA) {
    const price = PRICE[num];
    const nights = nightsBetween(arrival, departure);
    const totalAmount = nights * price;
    const email = `${client.replace(/\s+/g, ".").toLowerCase()}@example.com`;

    const booking = await BookingsModel.create({
      clientName: client,
      clientAddress: "Metro Manila",
      clientEmail: email,
      clientPhone: "0917" + String(1000000 + count * 7).slice(-7),
      paymentAmount: totalAmount,
      paymentMethod: type === "reservation" ? "Online Payment" : "Cash",
      type,
      status,
      arrivalDate: arrival,
      departureDate: departure,
      arrivalTime: status === "reservation" ? "14:00" : "13:00",
      totalAmount,
      room: rooms[num]._id,
    });

    const code = String(booking._id).slice(-6).toUpperCase();
    const prefix = status === "completed" ? "CHK" : status === "active" ? "PPY" : "RSV";
    const payDate = status === "completed" ? departure : status === "active" ? arrival : shift(arrival, -1);
    await PaymentModel.create({
      date: payDate,
      amount: totalAmount,
      receivedBy: type === "reservation" ? "online payment" : "Staff",
      paymentBy: client,
      method: type === "reservation" ? "Online Payment" : "Cash",
      refNumber: `${prefix}-${code}`,
      folio: `FOL-${payDate.replace(/-/g, "")}-${code}`,
      balance: 0,
    });
    count++;
  }

  // ── 3. All stays are historical (Jan-Aug 2026); no live holds today ──
  for (const roomDoc of Object.values(rooms)) {
    await RoomModel.updateOne({ _id: roomDoc._id }, { $set: { status: "available" } });
  }

  // ── 4. Summary ──
  const seededB = await BookingsModel.find().sort({ arrivalDate: 1 }).populate("room");
  console.log(`Seeded ${seededB.length} bookings:`);
  for (const b of seededB) {
    const span = b.departureDate ? `${b.arrivalDate}→${b.departureDate}` : b.arrivalDate;
    console.log(`  Unit ${b.room.roomNumber} ${span} ${b.clientName.padEnd(16)} ${b.status.padEnd(11)} ${b.type.padEnd(11)} ₱${b.paymentAmount}/${b.totalAmount}`);
  }
  const roomsNow = await RoomModel.find().sort({ roomNumber: 1 });
  console.log("Room statuses:", roomsNow.map((r) => `#${r.roomNumber}=${r.status}`).join(", "));

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });