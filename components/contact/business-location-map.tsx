import Link from "next/link";

type BusinessLocationMapProps = {
  address: string;
};

export default function BusinessLocationMap({ address }: BusinessLocationMapProps) {
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
  const directionsUrl = `https://maps.google.com/maps?daddr=${encodeURIComponent(address)}`;

  return (
    <section className="business-map-section" aria-labelledby="map-title">
      <div className="business-map-heading">
        <div><p className="contact-eyebrow">Find us</p><h2 id="map-title">Visit our studio</h2></div>
        <Link href={directionsUrl} target="_blank" rel="noreferrer">Get directions<span aria-hidden="true">↗</span></Link>
      </div>
      <div className="business-map-frame">
        <iframe
          title={`Map showing ${address}`}
          src={mapUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </section>
  );
}