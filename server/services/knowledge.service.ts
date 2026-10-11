import { aiFaq, aiKnowledge } from "../types/system.type";
import { sanitizeAiText } from "../utils/ai";

export const KNOWLEDGE_TEXT_FIELDS = [
  "location",
  "contactPhone",
  "frontDesk",
  "support",
  "checkInPolicy",
  "checkOutPolicy",
  "bookingPolicy",
  "cancellationPolicy",
  "refundPolicy",
  "paymentPolicy",
  "idRequirements",
  "houseRules",
  "petPolicy",
  "smokingPolicy",
  "visitorPolicy",
  "otherPolicies",
  "instructions",
] as const;

type KnowledgeTextField = (typeof KNOWLEDGE_TEXT_FIELDS)[number];

const FIELD_LIMITS: Record<KnowledgeTextField, number> = {
  location: 300,
  contactPhone: 100,
  frontDesk: 500,
  support: 500,
  checkInPolicy: 1500,
  checkOutPolicy: 1500,
  bookingPolicy: 1500,
  cancellationPolicy: 1500,
  refundPolicy: 1500,
  paymentPolicy: 1500,
  idRequirements: 1000,
  houseRules: 2000,
  petPolicy: 1000,
  smokingPolicy: 1000,
  visitorPolicy: 1000,
  otherPolicies: 3000,
  instructions: 2000,
};

const FIELD_LABELS: Record<KnowledgeTextField, string> = {
  location: "Location / address",
  contactPhone: "Contact phone",
  frontDesk: "Front desk",
  support: "Customer support",
  checkInPolicy: "Check-in policy",
  checkOutPolicy: "Check-out policy",
  bookingPolicy: "Booking policy",
  cancellationPolicy: "Cancellation policy",
  refundPolicy: "Refund policy",
  paymentPolicy: "Payment policy",
  idRequirements: "ID requirements",
  houseRules: "House rules",
  petPolicy: "Pet policy",
  smokingPolicy: "Smoking policy",
  visitorPolicy: "Visitor policy",
  otherPolicies: "Other policies",
  instructions: "Staff instructions for the assistant",
};

export const MAX_AMENITIES = 50;
export const MAX_FAQS = 40;
export const SYSTEM_INFO_MAX = 20000;

export function validateAiKnowledge(raw: unknown): { value?: aiKnowledge; error?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "AI knowledge must be an object." };
  }
  const body = raw as Record<string, unknown>;
  const value = {} as aiKnowledge;

  for (const field of KNOWLEDGE_TEXT_FIELDS) {
    const input = body[field];
    if (input !== undefined && input !== null && typeof input !== "string") {
      return { error: `${FIELD_LABELS[field]} must be text.` };
    }
    const text = typeof input === "string" ? input.trim() : "";
    if (text.length > FIELD_LIMITS[field]) {
      return { error: `${FIELD_LABELS[field]} must be at most ${FIELD_LIMITS[field]} characters.` };
    }
    value[field] = text;
  }

  const amenitiesInput = body.amenities ?? [];
  if (!Array.isArray(amenitiesInput)) return { error: "Amenities must be a list." };
  const amenities: string[] = [];
  const seen = new Set<string>();
  for (const item of amenitiesInput) {
    if (typeof item !== "string") return { error: "Each amenity must be text." };
    const text = item.trim();
    if (!text) continue;
    if (text.length > 120) return { error: "Each amenity must be at most 120 characters." };
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    amenities.push(text);
  }
  if (amenities.length > MAX_AMENITIES) return { error: `At most ${MAX_AMENITIES} amenities are allowed.` };
  value.amenities = amenities;

  const faqsInput = body.faqs ?? [];
  if (!Array.isArray(faqsInput)) return { error: "FAQs must be a list." };
  const faqs: aiFaq[] = [];
  for (const item of faqsInput) {
    if (!item || typeof item !== "object") return { error: "Each FAQ needs a question and an answer." };
    const question = typeof (item as any).question === "string" ? (item as any).question.trim() : "";
    const answer = typeof (item as any).answer === "string" ? (item as any).answer.trim() : "";
    if (!question && !answer) continue;
    if (!question || !answer) return { error: "Each FAQ needs both a question and an answer." };
    if (question.length > 200) return { error: "FAQ questions must be at most 200 characters." };
    if (answer.length > 1000) return { error: "FAQ answers must be at most 1000 characters." };
    faqs.push({ question, answer });
  }
  if (faqs.length > MAX_FAQS) return { error: `At most ${MAX_FAQS} FAQs are allowed.` };
  value.faqs = faqs;

  return { value };
}

export function buildKnowledgeContext(system: any): string {
  const knowledge: Partial<aiKnowledge> = system?.aiKnowledge || {};
  const lines: string[] = [];
  const add = (label: string, text: unknown, max = 2000) => {
    const clean = sanitizeAiText(typeof text === "string" ? text : "", max);
    if (clean) lines.push(`${label}: ${clean}`);
  };

  add("Hotel name", system?.systemName, 100);
  add("Description", system?.description, 1000);
  add("Contact email", system?.contactEmail, 200);
  add("Facebook page", system?.facebook, 300);
  for (const field of KNOWLEDGE_TEXT_FIELDS) {
    if (field === "instructions") continue;
    add(FIELD_LABELS[field], knowledge[field], FIELD_LIMITS[field]);
  }

  const amenities = (knowledge.amenities || [])
    .map((a) => sanitizeAiText(a, 120))
    .filter(Boolean);
  if (amenities.length) lines.push(`Hotel amenities: ${amenities.join("; ")}`);

  const faqs = (knowledge.faqs || [])
    .map((f) => ({ q: sanitizeAiText(f?.question, 200), a: sanitizeAiText(f?.answer, 1000) }))
    .filter((f) => f.q && f.a);
  if (faqs.length) {
    lines.push("Frequently asked questions:");
    for (const f of faqs) lines.push(`- Q: ${f.q}\n  A: ${f.a}`);
  }

  add("Additional hotel notes", system?.systemInfo, 5000);

  return lines.length ? lines.join("\n") : "(No hotel information has been configured yet.)";
}

export function buildStaffInstructions(system: any): string {
  return sanitizeAiText(system?.aiKnowledge?.instructions, FIELD_LIMITS.instructions);
}
