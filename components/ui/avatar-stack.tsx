import Image from "next/image";

type AvatarStackProps = {
  images: readonly string[];
  additionalCount?: number;
  label: string;
};

export default function AvatarStack({
  images,
  additionalCount = 0,
  label,
}: AvatarStackProps) {
  return (
    <div className="avatar-stack" role="img" aria-label={label}>
      {images.map((image) => (
        <span className="avatar" key={image}>
          <Image src={image} alt="" fill sizes="32px" />
        </span>
      ))}
      {additionalCount > 0 && (
        <span className="avatar-count">+{additionalCount}</span>
      )}
    </div>
  );
}