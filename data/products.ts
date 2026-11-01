import type { Product } from "@/features/products/types/product";

export const products = [
  {
    id: "norosilk-aurora-silk-44",
    slug: "aurora-silk-44",
    sku: "NV-AUR-044",
    title: "Aurora Silk #44",
    details: "Tech-Handloom · Kanchipuram",
    description:
      "An emerald-and-gold handloom silk saree woven in Kanchipuram, combining heritage zari work with a modern textile finish.",
    category: "Quantum Silk",
    currency: "USD",
    priceCents: 12800,
    compareAtPriceCents: 18500,
    minimumOrderQuantity: 50,
    inventory: 1200,
    status: "published",
    featured: true,
    seoTitle: "Aurora Silk Saree #44 | Norosilk",
    seoDescription: "Emerald-and-gold Kanchipuram tech-handloom silk saree.",
    saree: {
      fabric: "Pure silk",
      weave: "Kanchipuram handloom",
      color: "Emerald and gold",
      embellishment: "Zari border",
      occasion: "Wedding and festive",
      lengthMeters: 6.3,
      blousePiece: true,
      washCare: "Dry clean only",
    },
    images: [{
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_e40e7d071d_5ba2bbc598a2461e.png",
      alt: "Emerald and gold silk saree with intricate futuristic fabric details",
    }],
    shippingDetails: "Export-ready batch. Shipping terms are confirmed with the supplier.",
    options: [],
  },
  {
    id: "norosilk-nebula-zari-12",
    slug: "nebula-zari-12",
    sku: "NV-NEB-012",
    title: "Nebula Zari #12",
    details: "Holographic · Varanasi",
    description:
      "A Varanasi Banarasi saree with silver and pastel-pink zari detailing, produced for distinctive occasion and retail collections.",
    category: "Neo-Banarasi",
    currency: "USD",
    priceCents: 21400,
    compareAtPriceCents: 29000,
    minimumOrderQuantity: 30,
    inventory: 450,
    status: "published",
    featured: true,
    seoTitle: "Nebula Zari Saree #12 | Norosilk",
    seoDescription: "Silver and pastel-pink Banarasi saree with zari work.",
    saree: {
      fabric: "Silk blend",
      weave: "Banarasi brocade",
      color: "Silver and pastel pink",
      embellishment: "Holographic zari",
      occasion: "Reception and evening",
      lengthMeters: 6.3,
      blousePiece: true,
      washCare: "Dry clean only",
    },
    images: [{
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_43a4d91d1a_8b9bedb3900e510e.png",
      alt: "Silver and pastel pink Banarasi saree with shimmering zari work",
    }],
    shippingDetails: "Export-ready batch. Shipping terms are confirmed with the supplier.",
    options: [],
  },
  {
    id: "norosilk-void-organza-09",
    slug: "void-organza-09",
    sku: "NV-VOI-009",
    title: "Void Organza #09",
    details: "Embroidered · Jaipur",
    description:
      "A dramatic black organza saree from Jaipur, finished with metallic embroidery and fine sequin work.",
    category: "Fiber Glam",
    currency: "USD",
    priceCents: 17200,
    compareAtPriceCents: 24500,
    minimumOrderQuantity: 25,
    inventory: 800,
    status: "published",
    featured: false,
    seoTitle: "Void Organza Saree #09 | Norosilk",
    seoDescription: "Black Jaipur organza saree with metallic embroidery.",
    saree: {
      fabric: "Organza",
      weave: "Plain weave",
      color: "Black",
      embellishment: "Metallic embroidery and sequins",
      occasion: "Evening and formal",
      lengthMeters: 6.3,
      blousePiece: true,
      washCare: "Dry clean only",
    },
    images: [{
      src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/gen_a3b5db285d_237fef0bb9cc1b58.png",
      alt: "Black designer saree with metallic embroidery and sequins",
    }],
    shippingDetails: "Export-ready batch. Shipping terms are confirmed with the supplier.",
    options: [],
  },
] satisfies readonly Product[];

export type { Product } from "@/features/products/types/product";

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getProductById(id: string) {
  return products.find((product) => product.id === id);
}