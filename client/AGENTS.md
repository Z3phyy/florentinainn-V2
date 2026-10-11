<!-- BEGIN:nextjs-agent-rules -->


================================================================================
                    GENERAL CODING STYLE GUIDE
================================================================================
Stack: Next.js + TypeScript + shadcn/ui
Philosophy: Functional first. Minimal styling. Polish later.
================================================================================

TABLE OF CONTENTS
  1. Project Structure
  2. Page & Route Organization
  3. Component Structure
  4. API Calls & Data Fetching
  5. Types
  6. State Management (Zustand)
  7. Utility Functions
  8. Custom Hooks
  9. UI Components (shadcn)
  10. Styling Philosophy
  11. File Upload
  12. Import Conventions
  13. Minimal UI Philosophy
  14. Self-Contained Modal & Sheet Pattern

================================================================================
1. PROJECT STRUCTURE
================================================================================

Project uses Next.js App Router. All source code lives under src/.

src/
  app/                        # Next.js App Router directory
    api/                      # Next.js API routes (route.ts)
    types/                    # TypeScript interfaces *only*
    utils/                    # Utility/helper functions
    hooks/                    # Custom React hooks
    globals.css               # Global styles + Tailwind theme
    layout.tsx                # Root layout (providers)
    page.tsx                  # Landing/public page
  components/
    ui/                       # Shared/reusable UI components (shadcn + custom)
  hooks/                      # App-level hooks
  lib/                        # Utility libraries (cn/utils)

KEY RULES:
  - Pages use "use client" directive when client-side features are needed.
  - Each page route is a folder with page.tsx as the entry point.
  - Organize pages by feature/module, not by user role (unless the project requires it).

================================================================================
2. PAGE & ROUTE ORGANIZATION
================================================================================

- Each page route = folder with page.tsx as the default export.
- Page function is named "Page" and exported as default.
- Example:

  app/dashboard/
    page.tsx
    components/
      header.tsx
      stats.tsx

- Page-specific components go in a "components/" folder INSIDE the page folder.
- If a page has dynamic routes, use [id] folder:

  app/post/[id]/
    page.tsx
    components/
      commentSection.tsx
      shareButton.tsx

- Named exports for components inside components/ folders.
- page.tsx always uses "export default function Page()".

================================================================================
3. COMPONENT STRUCTURE
================================================================================

A. PAGE-SPECIFIC COMPONENTS
   - Stored in components/ folder within the page directory.
   - Named exports (not default).
   - Example: export function CommentSection({ postId }: { postId: string })

B. SHARED/REUSABLE UI COMPONENTS
   - Stored in components/ui/.
   - These are shadcn components + custom shared components.
   - Example: button.tsx, dialog.tsx

C. COMPONENT FILE PATTERN
   - Each component file exports one main component.
   - Use named exports: export function ComponentName()
   - Props are typed inline with interface or type:
     export function MyComponent({ prop1, prop2 }: { prop1: string; prop2: number })

================================================================================
4. API CALLS & DATA FETCHING
================================================================================

A. AXIOS INSTANCE
   - Single axios instance with base URL from env variable.
   - Auth token attached via request interceptor (e.g., from localStorage, cookies, etc.).
   - Pattern:

     import axios from "axios";
     const axiosInstance = axios.create({
       baseURL: process.env.NEXT_PUBLIC_API_URL
     });
     axiosInstance.interceptors.request.use((config) => {
       const token = localStorage.getItem("token");
       if (token) config.headers.Authorization = `Bearer ${token}`;
       return config;
     });
     export default axiosInstance;

B. DATA FETCHING (@tanstack/react-query)
   - useQuery for GET requests. Pattern:

     const { data } = useQuery({
       queryKey: ["unique_key"],
       queryFn: () => axiosInstance.get("/endpoint"),
     });

   - Optional: async queryFn for explicit typing:

     const { data } = useQuery({
       queryKey: ["key"],
       queryFn: async (): Promise<Type> => {
         const response = await axiosInstance.get("/endpoint");
         return response.data;
       },
     });

   - useMutation for POST/PUT/PATCH/DELETE. Pattern:

     const mutation = useMutation({
       mutationFn: (data: InputType) => axiosInstance.post("/endpoint", data),
       onSuccess: (response) => { /* handle success */ },
       onError: (err) => { /* handle error */ },
     });

   - useMutation + FormData for file uploads:

     const submitMutation = useMutation({
       mutationFn: (data: FormData) => axiosInstance.post("/endpoint", data),
       onSuccess: (response) => { /* ... */ },
       onError: () => errorAlert("error occurred"),
     });

   - refetchInterval for polling: refetchInterval: 5000

C. MUTATION PATTERN (inline in page component)
   - Define mutation inside the page/component.
   - Use isLoading / isPending from mutation state for loading UI.
   - On success: show success message, close modals, update local state.
   - On error: show error message.

D. API ROUTES (Next.js API routes)
   - Stored in src/app/api/ folder.
   - Each route is a folder with route.ts.
   - Use NextResponse for responses.

================================================================================
5. TYPES
================================================================================

A. LOCATION: src/app/types/
   - All global TypeScript interfaces go here.
   - File naming: entity.type.ts (e.g., user.type.ts, post.type.ts).
   - One file per domain entity.

B. INTERFACE CONVENTION
   - Use descriptive, consistent naming.
   - Separate input types from response types when appropriate.
   - Example:

     export interface UserInput {
       name: string;
       email: string;
     }

     export interface User extends UserInput {
       id: string;
       createdAt: string;
     }

   - Nested references use imported interfaces.

C. EXPORT CONVENTION
   - Always use named exports (export interface).
   - Use @/app/types/... path alias.

================================================================================
6. STATE MANAGEMENT (ZUSTAND)
================================================================================

A. LOCATION: src/app/store/
   - One file per store.

B. STORE PATTERN
   - Use create with persist middleware for persistent state.
   - TypeScript typed store.
   - Pattern:

     import { create } from 'zustand';
     import { persist, createJSONStorage } from 'zustand/middleware';

     type StoreType = {
       key: Type | null;
       setKey: (data: Type) => void;
       clearKey: () => void;
     };

     const useStore = create<StoreType>()(
       persist(
         (set) => ({
           key: null,
           setKey: (data) => set({ key: data }),
           clearKey: () => set({ key: null }),
         }),
         {
           name: 'store-name',
           storage: createJSONStorage(() =>
             typeof window !== 'undefined' ? localStorage : {
               getItem: () => null,
               setItem: () => {},
               removeItem: () => {},
             }
           ),
         }
       )
     );

     export default useStore;

C. USAGE IN COMPONENTS
   - const { user, setUser } = useUserStore();

D. FILE NAMING
   - camelCase: useUserStore.ts

================================================================================
7. UTILITY FUNCTIONS
================================================================================

A. LOCATION: src/app/utils/
   - All helper/utility functions go here.
   - One file per domain/concern.

B. COMMON UTILITY TYPES
   - axios.ts           - Axios instance with auth interceptor
   - alert.ts           - Toast/notification helpers (successAlert, errorAlert, confirmAlert)
   - customFunction.ts  - Business logic helpers (formatting, calculations, etc.)
   - upload.ts          - File upload function

C. EXPORT
   - Named exports for functions: export const functionName = () => { ... }

================================================================================
8. CUSTOM HOOKS
================================================================================

A. LOCATION: src/app/hooks/
   - Custom React hooks go here.
   - Usually for browser APIs or shared logic.

B. PATTERN
   - export default function useHookName() { ... }
   - Example: useGeolocation - wraps navigator.geolocation.

================================================================================
9. UI COMPONENTS (SHADCN)
================================================================================

A. MODAL/DIALOG PATTERN (deprecated — see section 14 for the current pattern)
   - Old pattern using props: <Dialog open={open} onOpenChange={setOpen}> ...

B. SHEET PATTERN (deprecated — see section 14 for the current pattern)
   - Old pattern using props: <Sheet open={open} onOpenChange={setOpen}> ...

C. IMPORT PATH
   - import { Button } from "@/components/ui/button"
   - import { Dialog, DialogContent, ... } from "@/components/ui/dialog"

================================================================================
10. STYLING PHILOSOPHY
================================================================================

- Use shadcn/ui default styling out of the box.
- Focus on functionality first — do not spend time on custom styling or animations.
- Minimal Tailwind classes only for layout structure (flex, grid, spacing, sizing).
- Avoid decorative CSS (shadows, gradients, complex animations, hover effects, transitions).
- Keep it bare and functional. The UI will be polished at a later stage.
- Use default shadcn components without overriding their styles unless absolutely necessary for layout.

================================================================================
11. FILE UPLOAD
================================================================================

A. IN-PAGE FILE HANDLING PATTERN
   - State: const [file, setFile] = useState<File | null>(null)
   - Preview: const [preview, setPreview] = useState<string | null>(null)
   - On file select:
     const handleFileChange = (file: File | null) => {
       setFile(file);
       if (file) setPreview(URL.createObjectURL(file));
     };
   - Input:
     <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />

B. SENDING FILES TO BACKEND
   - Use FormData + axiosInstance.post:
     const formData = new FormData();
     formData.append("file", file);
     formData.append("fieldName", value);
     mutation.mutate(formData);

================================================================================
12. IMPORT CONVENTIONS
================================================================================

A. PATH ALIASES
   - @/app/...        for app directory files
   - @/components/ui/...  for shared UI components
   - @/lib/...        for lib utilities

B. IMPORT ORDER (convention observed)
   1. React/Next.js imports
   2. Third-party libraries (@tanstack/react-query, zustand, axios, etc.)
   3. Components (@/components/ui/...)
   4. App utils and stores (@/app/utils/..., @/app/store/...)
   5. Types (@/app/types/...)
   6. Icons (lucide-react or similar)

C. EXAMPLE
   "use client";
   import { useState, useEffect } from "react";
   import { useQuery } from "@tanstack/react-query";
   import axiosInstance from "@/app/utils/axios";
   import useUserStore from "@/app/store/useUserStore";
   import { Button } from "@/components/ui/button";
   import { bookingInterface } from "@/app/types/booking.type";
   import { Calendar, Clock } from "lucide-react";

================================================================================
13. MINIMAL UI PHILOSOPHY
================================================================================

CORE PRINCIPLE:
  "Functional first, minimal styling, polish later."
  Build working functionality with minimal code.
  UI polish comes at the end of development.

RULES:
  - Keep components as simple as possible.
  - Avoid premature abstraction.
  - Use default shadcn/ui styling — no custom CSS.
  - Don't over-engineer; solve the immediate problem.
  - Defer visual enhancements (animations, micro-interactions, custom themes) to later stages.
  - Write clean, readable code that's easy to refactor later.

================================================================================
14. SELF-CONTAINED MODAL & SHEET PATTERN
================================================================================

Always use self-contained modal/sheet components. The trigger button and open/close state
live INSIDE the component, NOT in the parent page.

A. MODAL/DIALOG PATTERN (REQUIRED)

   - The modal component manages its own `open` state via `useState(false)`.
   - The trigger button is inside the component wrapped with `<DialogTrigger asChild>`.
   - The button's `onClick` calls `setOpen(true)`.
   - Cancel buttons call `setOpen(false)`.
   - For edit modals, pass the entity data as a prop directly (no `selectedX` state in the parent).
   - In the parent page, render the modal component inline — no `open`/`onOpenChange`/`selectedX` state.

   Add/Create Modal (no data needed):
     export function AddEntityModal() {
       const [open, setOpen] = useState(false);
       ...
       return (
         <Dialog open={open} onOpenChange={setOpen}>
           <DialogTrigger asChild>
             <Button onClick={() => setOpen(true)}>
               <Plus className="size-4" />
               Add Entity
             </Button>
           </DialogTrigger>
           <DialogContent>
             <DialogHeader>
               <DialogTitle>Add Entity</DialogTitle>
               <DialogDescription>Create a new entity.</DialogDescription>
             </DialogHeader>
             {/* form fields */}
             <DialogFooter>
               <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
               <Button type="submit">Save</Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>
       );
     }

   Edit Modal (receives entity data directly):
     export function EditEntityModal({ entity }: { entity: EntityType }) {
       const [open, setOpen] = useState(false);
       // Pre-populate fields when modal opens
       useEffect(() => {
         if (open) {
           setName(entity.name);
         }
       }, [open, entity]);
       ...
       return (
         <Dialog open={open} onOpenChange={setOpen}>
           <DialogTrigger asChild>
             <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
               <Pencil className="size-3.5" />
             </Button>
           </DialogTrigger>
           <DialogContent>
             ...
           </DialogContent>
         </Dialog>
       );
     }

   Usage in parent page (render inline, no state!):
     // For "Add" button in the header:
     <AddEntityModal />

     // For "Edit" buttons inside a map loop:
     {data.map((entity) => (
       <TableRow key={entity._id}>
         ...
         <EditEntityModal entity={entity} />
       </TableRow>
     ))}

   CRITICAL RULES:
     - Modal component receives NO `open` or `onOpenChange` props.
     - Parent page has NO `modalOpen` or `selectedEntity` state variables.
     - Parent page does NOT import `useState` for modals.
     - Modal is rendered right next to its trigger button, not at the bottom of the page.
     - The edit modal's `useEffect` depends on `[open, entity]` to re-populate on every open.

B. SHEET PATTERN (same approach)

     export function EntitySheet() {
       const [open, setOpen] = useState(false);
       ...
       return (
         <Sheet open={open} onOpenChange={setOpen}>
           <SheetTrigger asChild>
             <Button onClick={() => setOpen(true)}>Open</Button>
           </SheetTrigger>
           <SheetContent>
             ...
           </SheetContent>
         </Sheet>
       );
     }

C. DELETE ACTION (no modal needed)

   - Delete buttons use `confirmAlert` directly with the mutation:
     <Button onClick={() =>
       confirmAlert(`Delete "${entity.name}"?`, "Delete", () => deleteMutation.mutate(entity._id))
     }>
       <Trash2 className="size-3.5 text-destructive" />
     </Button>

================================================================================
END OF GUIDE
================================================================================
