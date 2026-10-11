============================================================
  PROJECT ARCHITECTURE & CODING RULES
  (Backend — Express + MongoDB + TypeScript)
============================================================

This document describes the standard folder structure, naming conventions,
coding patterns, and best practices used across projects. When generating or
reviewing code, always follow these rules unless explicitly overridden.


1.  FOLDER STRUCTURE
============================================================

Every project follows this top-level layout:

  .
  ├── controller/         # Express route handlers (thin layer)
  ├── services/           # Business logic & database queries
  ├── model/              # Mongoose schemas & models
  ├── routes/             # Express Router definitions
  ├── types/              # TypeScript interfaces / types
  ├── middleware/         # Express middleware (auth, validation, etc.)
  ├── utils/              # Utility functions & configuration modules
  ├── uploads/            # Temporary local file storage (gitignored)
  ├── index.ts            # Application entry point
  ├── package.json
  └── tsconfig.json

  Optional folders:
  ├── config/             # Environment-specific config files
  ├── validators/         # Request validation schemas
  └── tests/              # Unit / integration tests

Rule: Each logical entity (account, booking, post, etc.) has its own set of
       files — one per layer — never mix concerns in a single file.


2.  NAMING CONVENTIONS
============================================================

  2.1  Files
  ────────────────────────────────────────────────────────────
  Pattern:       {entity}.{layer}.ts        (lowercase, kebab-case for multi-word)

  Examples:
    accounts.controller.ts
    account.route.ts
    account.model.ts
    acccount.service.ts
    accounts.type.ts
    auth.ts (middleware)
    cloudinary.ts (utility)

  2.2  Classes
  ────────────────────────────────────────────────────────────
  Pattern:       {Entity}{Layer}          (PascalCase)

  Examples:
    AccountController
    AccountService
    BookingService
    PostController

  2.3  Methods & Functions
  ────────────────────────────────────────────────────────────
  Pattern:       camelCase                (verbs describing the action)

  Examples:
    create(), get(id), getAll(), getByArtist(artist),
    update(), delete(), checkEmailIfExist(email)

  2.4  Interfaces
  ────────────────────────────────────────────────────────────
  Two variants per entity:

    {entity}InterfaceInput     — For creation / input (IDs are plain strings)
    {entity}Interface          — For reading / output (includes _id, populated fields)

  Examples:
    accountInterfaceInput,    accountInterface
    bookingInterfaceInput,    bookingInterface
    postInterfaceInput,       postInterface
    inventoryInterfaceInput,  inventoryInterface


3.  LAYER RESPONSIBILITIES
============================================================

  3.1  Controller Layer  (controller/*.controller.ts)
  ────────────────────────────────────────────────────────────
  Purpose:   Handle HTTP requests & responses. Keep it thin.

  Rules:
    • All methods are static arrow functions assigned to the class.
    • Method signature:  static methodName = async (request: AuthRequest, response: Response) => { ... }
    • NEVER call Mongoose models directly — always delegate to a Service.
    • Extract data from request (body, params, query, account, file).
    • Call one or more Service methods.
    • Send response with:  response.send(data)  or  response.status(code).json(data)
    • Handle errors with try/catch, log with console.error, respond 500.
    • Use early return pattern for error responses to stop execution.

  Example skeleton:

    export class AccountController {
        static getAccount = async (request: AuthRequest, response: Response) => {
            const { id } = request.params
            const account = await AccountService.get(id)
            response.send(account)
        }

        static createAccount = async (request: AuthRequest, response: Response) => {
            try {
                const data: accountInterfaceInput = request.body
                if (await AccountService.checkEmailIfExist(data.email)) {
                    response.status(500).send("email already exist")
                    return
                }
                const result = await AccountService.create(data)
                response.send(result)
            } catch (error) {
                console.error(error)
                response.status(500).json({ error: "Operation failed" })
            }
        }
    }

  3.2  Service Layer  (services/*.service.ts)
  ────────────────────────────────────────────────────────────
  Purpose:   Business logic & database operations.

  Rules:
    • All methods are static.
    • Import the Mongoose model — never import another service or controller.
    • Return the result directly (let the controller handle responses/errors).
    • Use Mongoose methods:  Model.create(), Model.find(), Model.findById(),
      Model.findByIdAndUpdate(), Model.findByIdAndDelete(), Model.findOne()
    • Use .populate("refField") for referenced documents when returning data.
    • Use .sort({ _id: -1 }) for newest-first ordering.
    • Use .limit(n) when limiting results.

  Example skeleton:

    export class AccountService {
        static async create(data: accountInterfaceInput) {
            return await AccountModel.create(data)
        }

        static async get(id: string) {
            return await AccountModel.findById(id)
        }

        static async getByEmail(email: string) {
            return await AccountModel.findOne({ email })
        }

        static async getAll() {
            return await AccountModel.find()
        }

        static async update(id: string, data: Partial<accountInterface>) {
            return await AccountModel.findByIdAndUpdate(id, data, { new: true })
        }

        static async delete(id: string) {
            return await AccountModel.findByIdAndDelete(id)
        }

        static async checkIfExists(email: string) {
            return await AccountModel.findOne({ email })
        }
    }

    TIP: For atomic updates like incrementing a value, use $inc:
      Model.findByIdAndUpdate(id, { $inc: { stocks: amount } }, { new: true })

    Use $push for array fields:
      Model.findByIdAndUpdate(id, { $push: { items: newItem } })

  3.3  Model Layer  (model/*.model.ts)
  ────────────────────────────────────────────────────────────
  Purpose:   Define Mongoose schemas and export the model.

  Rules:
    • Import mongoose and Schema from 'mongoose'.
    • Define sub-documents as separate schemas with { _id: false }.
    • Use mongoose.Schema.Types.ObjectId with ref for references.
    • Only define validation that is truly schema-level (required, type).
    • Export default the model.

  Example skeleton:

    import mongoose, { Schema } from 'mongoose'

    const ItemSchema = new Schema({
        name: { type: String, required: true },
        qty: { type: Number, required: true },
    }, { _id: false })

    const EntitySchema = new Schema({
        owner: { type: mongoose.Schema.Types.ObjectId, ref: "Accounts", required: true },
        title: { type: String, required: true },
        items: [ItemSchema],
        status: { type: String, required: true },
        createdAt: { type: String, required: false },
    })

    export default mongoose.model('Entities', EntitySchema)

  3.4  Route Layer  (routes/*.route.ts)
  ────────────────────────────────────────────────────────────
  Purpose:   Define HTTP endpoints and attach middleware + controller.

  Rules:
    • Create one route file per entity.
    • Import Router from 'express', create instance:  const route = Router()
    • Always import and use authenticateJWT for protected routes.
    • Import upload from utils/upload for file upload endpoints.
    • Pattern:  route.{method}("{path}", [middleware...], Controller.handler)
    • Order routes from most specific to least specific.
    • Export default the router instance.

  Example skeleton:

    import { Router } from "express"
    import { EntityController } from "../controller/entity.controller"
    import { authenticateJWT } from "../middleware/auth"
    import { upload } from "../utils/upload"

    const route = Router()

    route.get("/", authenticateJWT, EntityController.getAll)
    route.get("/:id", authenticateJWT, EntityController.getById)
    route.post("/", authenticateJWT, EntityController.create)
    route.post("/withImage", authenticateJWT, upload.single("file"), EntityController.createWithImage)
    route.put("/:id", authenticateJWT, EntityController.update)
    route.delete("/:id", authenticateJWT, EntityController.delete)

    export default route

  3.5  Route Aggregation  (routes/route.ts)
  ────────────────────────────────────────────────────────────
  Purpose:   Central file that imports all entity routes and mounts them.

  Pattern:

    import { Router } from "express"
    import accountRoute from "./account.route"
    import authRoute from "./auth.route"

    const routes = Router()
    routes.use("/account", accountRoute)
    routes.use("/auth", authRoute)
    export default routes

  In index.ts:  app.use(routes)

  3.6  Types Layer  (types/*.type.ts)
  ────────────────────────────────────────────────────────────
  Purpose:   Define TypeScript interfaces shared across layers.

  Rules:
    • Two interfaces per entity: *InterfaceInput (write) and *Interface (read).
    • *InterfaceInput uses plain string IDs for references.
    • *Interface includes _id and uses full populated interfaces for references.
    • Import accountInterface (or other entity interfaces) when referencing them.
    • Keep types clean — no implementation logic.

  Example skeleton:

    import { accountInterface } from "./accounts.type"

    export interface entityInterfaceInput {
        owner: string,
        title: string,
        status: string,
    }

    export interface entityInterface {
        _id: string,
        owner: accountInterface,
        title: string,
        status: string,
    }


4.  AUTHENTICATION PATTERN
============================================================

  4.1  Custom Request Type
  ────────────────────────────────────────────────────────────
  File: types/request.type.ts

    import { Request } from "express"
    import { accountInterface } from "./accounts.type"

    export interface AuthRequest extends Request {
        account?: accountInterface
    }

  4.2  JWT Middleware
  ────────────────────────────────────────────────────────────
  File: middleware/auth.ts

    • Extract Bearer token from Authorization header.
    • Verify with jwt.verify(token, JWT_SECRET).
    • Fetch account document by decoded ID using AccountService.get(id).
    • Map the document to accountInterface and attach to request.account.
    • Call next() on success, respond 401 on failure.

  4.3  Login / Token Generation
  ────────────────────────────────────────────────────────────
    • Compare password with bcrypt.compare().
    • Sign JWT:  jwt.sign({ id: account._id }, JWT_SECRET, { expiresIn: "3d" })
    • Return both account object and token to client.

  4.4  Registration
  ────────────────────────────────────────────────────────────
    • Check if email exists with AccountService.checkEmailIfExist().
    • If exists, return 500 early.
    • Hash password with bcrypt.hash(password, 10).
    • Create account via AccountService.create().


5.  FILE / IMAGE UPLOAD PATTERN
============================================================

  Stack:  multer (local temp storage) → Cloudinary → delete local file

  5.1  Multer Setup (utils/upload.ts)
  ────────────────────────────────────────────────────────────
    • Uses multer.diskStorage to save to 'uploads/' folder.
    • Filename:  Date.now() + '-' + file.originalname
    • Export: upload (multer instance)

  5.2  Cloudinary Setup (utils/cloudinary.ts)
  ────────────────────────────────────────────────────────────
    • Configure with cloud_name, api_key, api_secret from .env.
    • Export cloudinary instance.

  5.3  Upload Flow (in controller)
  ────────────────────────────────────────────────────────────
    try {
        if (!request.file) {
            response.status(400).json({ error: 'No file uploaded' })
            return
        }
        const uploadResult = await cloudinary.uploader.upload(request.file.path, {
            folder: 'my_app_uploads',
            resource_type: "auto",
        })
        fs.unlinkSync(request.file.path)  // delete temp file
        const url = uploadResult.secure_url
        // ... use url in service calls ...
        response.send("success")
    } catch (error) {
        console.error(error)
        response.status(500).json({ error: 'Upload failed' })
    }

  5.4  Route Wiring
  ────────────────────────────────────────────────────────────
    Single file:   upload.single("fieldName")   (the "fieldName" must match the frontend FormData key)
    Multiple fields: upload.fields([{ name: 'field1', maxCount: 1 }, { name: 'field2', maxCount: 1 }])


6.  MIDDLEWARE CHAINING IN ROUTES
============================================================

  Typical chain order:

    1. authenticateJWT          (protect the route)
    2. upload.single('file')    (if file upload is needed — optional)
    3. custom validation        (if any — optional)
    4. Controller.handler       (the actual handler)

  Example:

    route.post("/create", authenticateJWT, upload.single("file"), Controller.create)


7.  ERROR HANDLING CONVENTION
============================================================

  • Controller catches errors and sends HTTP response.
  • Service does NOT catch errors — propagates them to controller.
  • Early return pattern for errors:

        if (!condition) {
            response.status(500).send("error message")
            return
        }

  • Try/catch only in controller methods that interact with external services:

        try {
            // logic
        } catch (error) {
            console.error(error)
            response.status(500).json({ error: 'Operation failed' })
        }


8.  ENTRY POINT (index.ts) PATTERN
============================================================

  Order of operations:

    1. Set timezone:  process.env.TZ = 'Asia/Manila'
    2. Load dotenv.
    3. Create express app.
    4. Configure: app.set('trust proxy', 1)
    5. Middleware: app.use(express.json()), app.use(cors())
    6. Routes: app.use(routes)
    7. MongoDB: mongoose.connect(MONGODB_URI)
    8. Listen: app.listen(port, callback)


9.  DATE / TIME UTILITY FUNCTIONS
============================================================

  Store time as plain strings, not Date objects.

    export const getTime = () => {
        const now = new Date()
        return now.toLocaleTimeString("en-US", {
            hour: "2-digit", minute: "2-digit", hour12: true,
        })
    }

    export const getDate = () => {
        const now = new Date()
        return now.toLocaleDateString("en-US")
    }

  Timezone is set globally at the top of index.ts:
    process.env.TZ = 'Asia/Manila'


10. POPULATION PATTERN
============================================================

  When a Mongoose schema uses ObjectId references, always populate in the
  Service method so the controller receives fully populated objects:

    Service.get = async (id: string) => {
        return await Model.findById(id)
            .populate("refField1")
            .populate("refField2")
            .sort({ _id: -1 })
    }

  For nested populations:

    .populate({
        path: "fieldName",
        populate: {
            path: "nestedField",
            model: "ModelName",
        },
    })


11. SORTING & LIMITING
============================================================

  • Newest-first:  .sort({ _id: -1 })
  • Limit results:  .limit(15)
  • Apply both in the service layer.


12. ENVIRONMENT VARIABLES
============================================================

  Use dotenv. Access via process.env.VARIABLE_NAME.
  Required variables (varies by project):

    PORT, MONGODB_URI_LIVE, JWT_SECRET,
    cloud_name, api_key, api_secret (Cloudinary)


13. PACKAGE.JSON SCRIPTS
============================================================

    "dev": "nodemon --exec ts-node index.ts"
    "build": "tsc"
    "start": "node dist/app.js"


14. SUMMARY OF THE DATA FLOW
============================================================

  Client Request
       │
       ▼
  Route (route/*.route.ts)
       │  - HTTP method + path
       │  - Middleware chain (auth, upload, validation)
       ▼
  Controller (controller/*.controller.ts)
       │  - Parse request (body, params, query, files, account)
       │  - Call Service method(s)
       ▼
  Service (services/*.service.ts)
       │  - Business logic
       │  - Mongoose queries
       ▼
  Model (model/*.model.ts)
       │  - Schema definition
       ▼
  MongoDB
       │
       ▼ (response bubbles back)
  Controller sends response (.send or .json)


15. GENERAL RULES
============================================================

  • Every entity folder follows the same pattern: 4 files minimum
    (controller, service, model, route) + types file.

  • Controllers and Services use static methods (no instantiation).

  • Models are exported as default from their file.

  • Routes are exported as default Router instances.

  • Types are defined in dedicated files, not inline.

  • Services import only their corresponding model, never other services.

  • Controllers can import multiple services (for complex workflows).

  • Never import a Controller inside another Controller.

  • Never import a Model directly in a Controller.

  • Use populate() in Service methods, never in Controllers.

  • Error strings are plain English, lowercase, no punctuation:

    ✅  response.status(500).send("email already exist")
    ❌  response.status(500).send({ error: "Email already exists!" })

  • File extensions always .ts (TypeScript), never .js.
