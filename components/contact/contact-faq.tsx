const questions = [
  {
    question: "How do I check an order status?",
    answer: "The current storefront does not yet create online orders. If you have a supplier reference, include it in your message so the team can identify your inquiry.",
  },
  {
    question: "How are shipping and delivery arranged?",
    answer: "Shipping terms are confirmed with the supplier for each wholesale batch. No delivery timeline is published until a supplier confirms it.",
  },
  {
    question: "What is the returns or refund policy?",
    answer: "A store-wide returns and refund policy has not been configured. Please confirm terms with the supplier before placing a wholesale order.",
  },
  {
    question: "Can I ask about saree specifications or a bulk batch?",
    answer: "Yes. Include the saree name or SKU, your target quantity, and the details you need in the message form.",
  },
];

export default function ContactFaq() {
  return (
    <section className="contact-faq" aria-labelledby="contact-faq-title">
      <div className="contact-section-heading">
        <p className="contact-eyebrow">A few quick answers</p>
        <h2 id="contact-faq-title">Before you reach out</h2>
      </div>
      <div className="contact-faq-list">
        {questions.map(({ question, answer }) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}