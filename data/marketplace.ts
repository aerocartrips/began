export const collections = [
  {
    title: "Quantum Silk",
    description: "Handloom silk embedded with biometric authentication fibers.",
    icon: "cpu",
    tone: "indigo",
  },
  {
    title: "Neo-Banarasi",
    description: "Traditional zari meets recycled liquid-metal threadwork.",
    icon: "dna",
    tone: "violet",
  },
  {
    title: "Fiber Glam",
    description: "Ultra-lightweight smart fabrics for the modern global gala.",
    icon: "wind",
    tone: "cyan",
  },
  {
    title: "Export Core",
    description: "Sustainable daily-wear weaves for high-volume retailers.",
    icon: "globe",
    tone: "slate",
  },
] as const;

export { products as batches } from "@/data/products";

export type Collection = (typeof collections)[number];
export type { Product as MarketplaceBatch } from "@/features/products/types/product";

export const auctionAvatars = [
  "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-1.jpg",
  "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-2.jpg",
  "https://storage.googleapis.com/uxpilot-auth.appspot.com/avatars/avatar-3.jpg",
] as const;