import Link from "next/link";

type BusinessLocationMapProps = {
  address: string | null;
};

export default function BusinessLocationMap({ address }: BusinessLocationMapProps) {
  if (!address) {
    return (
      <section className="business-map-placeholder" aria-labelledby="map-title">
        <div className="map-placeholder-mark" aria-hidden="true">N</div>
        <h2 id="map-title">Our location</h2>
        <p>A verified business address has not been configured yet.</p>
        <small>Set NEXT_PUBLIC_BUSINESS_ADDRESS to enable directions and the map.</small>
      </section>
    );
  }

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