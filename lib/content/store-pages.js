/**
 * Content pages every store has. Each store can edit them (Admin → Content);
 * until then, a default template filled with the store's own details is shown.
 */
export const STORE_PAGES = {
  about: { title: "About us", kind: "sections" },
  faq: { title: "Frequently asked questions", kind: "faq" },
  "privacy-policy": { title: "Privacy policy", kind: "sections" },
  "terms-and-conditions": { title: "Terms & conditions", kind: "sections" },
  shipping: { title: "Shipping policy", kind: "sections" },
  returns: { title: "Cancellation & refund policy", kind: "sections" },
  "care-guide": { title: "Saree care guide", kind: "sections" },
};

export const STORE_PAGE_SLUGS = Object.keys(STORE_PAGES);

/**
 * Default content, written for the store using its name and order settings.
 * These are starting points: store owners should review policies with their adviser.
 * @param {string} slug
 * @param {{ name: string, salesMode: string, contactEmail: string, returnWindowDays: number, cancellationWindowHours: number }} store
 * @returns {import("@/lib/content/types").StorePageContent}
 */
export function defaultStorePage(slug, store) {
  const contact = store.contactEmail ? `email ${store.contactEmail}` : "use our contact page";
  const wholesale = store.salesMode === "wholesale";
  const templates = {
    about: {
      summary: `${store.name} brings handwoven sarees from weaving clusters to ${wholesale ? "retailers and resellers" : "you"}.`,
      sections: [
        { heading: "Who we are", body: `${store.name} works directly with weavers and finishing units, so every saree is sourced, checked and dispatched by our own team.` },
        { heading: wholesale ? "How we work with businesses" : "How we work", body: wholesale ? "We sell in wholesale quantities with transparent per-piece pricing, quantity tiers and GST invoices. For large or custom orders, request a quote and our team will reply with a written offer." : "Every saree is checked before it ships, packed with care and sent with tracking." },
        { heading: "Talk to us", body: `Questions about a product or an order? ${contact[0].toUpperCase()}${contact.slice(1)} and we will get back to you.` },
      ],
    },
    faq: {
      summary: "Quick answers about orders, payments, delivery and returns.",
      faqs: [
        { question: "How do I track my order?", answer: "Use Track order with your order number and the email or phone used at checkout, or open the order in My account." },
        { question: "Which payment methods do you accept?", answer: "We accept UPI, cards, net banking and wallets through Razorpay. Prices are in Indian rupees (INR)." },
        ...(wholesale
          ? [
              { question: "Is there a minimum order quantity?", answer: "Yes. Each product shows its minimum order quantity and the per-piece price at each quantity tier." },
              { question: "Can I get a custom quote?", answer: "Yes. Use Request a quote with the products and quantities you need, including any branding or packaging requirements." },
              { question: "Do you provide GST invoices?", answer: "Yes. Add your GSTIN to your billing address at checkout and it will appear on the invoice." },
            ]
          : []),
        { question: "How long does delivery take?", answer: "Orders are usually dispatched within 2–4 working days. Delivery times depend on your location and are shown in your tracking updates." },
        { question: "Can I cancel or return an order?", answer: `Orders can be cancelled within ${store.cancellationWindowHours} hours if they have not shipped. Returns can be requested within ${store.returnWindowDays} days of delivery. See our cancellation & refund policy.` },
      ],
    },
    "privacy-policy": {
      summary: `How ${store.name} collects, uses and protects your personal data.`,
      sections: [
        { heading: "Information we collect", body: "We collect the details you give us when you create an account, place an order or contact us: your name, email, phone number, addresses, business details such as GSTIN, and your order history. Payments are processed by Razorpay; we do not store card or bank details." },
        { heading: "How we use it", body: "We use your information to process and deliver orders, issue invoices, provide support, prevent fraud and, if you agree, send you updates about products and offers." },
        { heading: "Sharing", body: "We share information only with service providers who help us run the store, such as payment processing, shipping and email delivery, and only as needed for those services, or where the law requires it." },
        { heading: "Cookies", body: "We use essential cookies to keep you signed in and to secure checkout. Your cart and wishlist are stored in your browser." },
        { heading: "Your choices and rights", body: `You can view and update your details in My account, download your data, change email preferences, or ask us to delete your account. To make a request, ${contact}.` },
        { heading: "Data security and retention", body: "We protect your data with encryption in transit, access controls and secure infrastructure. We keep order and invoice records for as long as tax and accounting laws require." },
      ],
    },
    "terms-and-conditions": {
      summary: `The terms that apply when you use the ${store.name} website and place orders.`,
      sections: [
        { heading: "Orders", body: wholesale ? "Orders are subject to the minimum order quantity and the quantity pricing shown on each product. An order is confirmed once payment is received." : "An order is confirmed once payment is received. We may cancel an order if a product becomes unavailable, in which case you will receive a full refund." },
        { heading: "Prices and payment", body: "Prices are in Indian rupees (INR) and exclude GST unless stated; GST and shipping charges are shown before you pay. Payments are processed securely by Razorpay." },
        { heading: "Product descriptions", body: "Handwoven sarees can vary slightly in colour, weave and finish. Photos are as accurate as possible, but colours may look different on different screens." },
        { heading: "Shipping, cancellations and returns", body: "Delivery, cancellations and refunds are governed by our shipping policy and our cancellation & refund policy." },
        { heading: "Accounts", body: "You are responsible for keeping your account credentials secure and for activity under your account." },
        { heading: "Governing law", body: "These terms are governed by the laws of India. Contact us first so we can try to resolve any dispute." },
      ],
    },
    shipping: {
      summary: "How and when we deliver your order.",
      sections: [
        { heading: "Dispatch", body: "Orders are usually dispatched within 2–4 working days of payment. Large wholesale orders may take longer; we will tell you if so." },
        { heading: "Delivery", body: "We ship across India with tracked courier and freight partners. Delivery time depends on your PIN code." },
        { heading: "Shipping charges", body: "Shipping charges, if any, are shown in your cart and at checkout before you pay." },
        { heading: "Tracking", body: "Once your order ships you can follow it from My account or the Track order page." },
      ],
    },
    returns: {
      summary: "Cancellations, returns and refunds.",
      sections: [
        { heading: "Cancellations", body: `You can cancel an order within ${store.cancellationWindowHours} hours of placing it, as long as it has not shipped, from the order page in My account.` },
        { heading: "Returns", body: `If a product arrives damaged or is not what you ordered, request a return within ${store.returnWindowDays} days of delivery from the order page. Products must be unused, with tags and original packaging.` },
        { heading: "Refunds", body: "Approved refunds are issued to the original payment method through Razorpay, usually within 5–7 working days of approval." },
        { heading: "Need help?", body: `If you have a question about a cancellation or return, ${contact}.` },
      ],
    },
    "care-guide": {
      summary: "Keep your sarees beautiful for years.",
      sections: [
        { heading: "Silk and zari", body: "Dry clean only. Avoid spraying perfume directly on the saree, and keep zari away from moisture to prevent tarnishing." },
        { heading: "Cotton and linen", body: "Hand wash separately in cold water with mild detergent for the first few washes. Dry in shade to protect the colours." },
        { heading: "Storage", body: "Store folded in a muslin or cotton cloth, not plastic. Refold every few months along different lines to prevent permanent creases." },
        { heading: "Ironing", body: "Iron on low to medium heat on the reverse side, with a cotton cloth between the iron and silk or zari work." },
      ],
    },
  };
  const template = templates[slug];
  return { slug, title: STORE_PAGES[slug].title, summary: template.summary, sections: template.sections ?? [], faqs: template.faqs ?? [], isDefault: true, updatedAt: null };
}
