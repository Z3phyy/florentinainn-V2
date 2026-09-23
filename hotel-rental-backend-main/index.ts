
import express,{ Request, Response } from 'express';
import mongoose from 'mongoose';
import routes from "./routes/route"
import cors from "cors"
import helmet from "helmet"
import dotenv from 'dotenv';
import 'dotenv/config';
import systemModel from './model/system.model';


dotenv.config();

process.env.NODE_ENV = process.env.NODE_ENV || "production";

const app = express();
const port = process.env.PORT || 5000;
const mongodb_uri = process.env.MONGODB_URI || "";

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "https://florentina-inn.vercel.app",
  "https://turbo-spoon-69w7pv74qjq7h4ggj-3000.app.github.dev"
];

app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

app.use(routes)

const runSchemaMigrations = async () => {
  try {
    const bookingRename = await mongoose.connection.collection("bookings").updateMany(
      {},
      { $rename: { arivalDate: "arrivalDate", arivalTime: "arrivalTime" } }
    );
    if (bookingRename.modifiedCount > 0) {
      console.log(`Migrated ${bookingRename.modifiedCount} booking(s): arivalDate/arivalTime -> arrivalDate/arrivalTime`);
    }

    const accountRename = await mongoose.connection.collection("accounts").updateMany(
      {},
      { $rename: { username: "email" } }
    );
    if (accountRename.modifiedCount > 0) {
      console.log(`Migrated ${accountRename.modifiedCount} staff account(s): username -> email`);
    }
  } catch (error) {
    console.log("Schema migration error: " + (error as Error).message);
  }
};

mongoose.connect(mongodb_uri)
  .then(async () => {
    console.log("Connected to MongoDB");
    await runSchemaMigrations();
  })
  .catch((error) => {
    console.log("MongoDB connection failed: " + (error as Error).message);
  });

app.get('/', async (request: Request, response: Response) => {
  response.send("working server...........")
});

app.get('/systemAccount', async (request: Request, response: Response) => {

  const system = await systemModel.findOne()
  if(system){
    response.send("system account exist...........")
    return
  }

 await systemModel.create({
  systemInfo: `
    Florentina Inn Business Information

    * Business Name: Florentina Inn
    * Location: Trece Martires City, Cavite
    * Contact Number: 090998934

    Operating Hours:

    * Open Monday to Friday.
    * Closed on Saturdays and Sundays.
    * Customer inquiries are only accommodated during business hours.

    Check-in and Check-out:

    * Flexible check-in and check-out anytime (no fixed check-in or check-out hours).
    * 24/7 front-desk reception and concierge assistance.

    Booking Policies:

    * Advance reservations are recommended.
    * Full payment or a reservation fee may be required before check-in.
    * Guests must provide a valid government-issued ID upon check-in.
    * Room availability is subject to confirmation.

    House Rules:

    * No smoking inside rooms.
    * No illegal drugs or prohibited substances.
    * No excessive noise or disruptive behavior.
    * Guests are responsible for any damage caused to hotel property.
    * Visitors who are not registered guests are not allowed inside rooms without permission.
    * Pets are not allowed unless approved by management.
    * Outside food and drinks are allowed in moderation.
    * Cooking inside rooms is prohibited.
    * The management reserves the right to refuse service to guests who violate hotel policies.

    Amenities:

    * Airconditioned rooms
    * Hot and cold shower
    * Cable TV/ DVD
    * Free WiFi internet
    * We serve Breakfast
    * Private Parking
    * Backup generator


  `,
  paymentMin: 1000,
  logo: "/logo.png",
  systemName: "Florentina Inn",
  header: "Comfortable and Affordable Rooms for Every Stay",
  description:
    "Florentina Inn offers clean, secure, and affordable room accommodations for travelers, families, and business guests. Enjoy comfortable rooms, modern amenities, and excellent customer service in a convenient location within Trece Martires City.",
});
  response.send("system account created...........")
});


app.use((request: Request, response: Response) => {
  response.status(404).json({ error: "Not found" });
});

app.use((error: unknown, request: Request, response: Response, next: Function) => {
  if (error instanceof mongoose.Error.CastError || (error as { name?: string })?.name === "CastError") {
    response.status(400).json({ error: "Invalid resource id" });
    return;
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  if (message === "Not allowed by CORS") {
    response.status(403).json({ error: message });
    return;
  }
  console.log("Unhandled error: " + message);
  response.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  const date = new Date
  console.log(`Server is running on http://localhost:${port} date: ${date}`);
});

