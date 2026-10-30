import AvatarStack from "@/components/ui/avatar-stack";

type AuctionNoteProps = {
  message: string;
  avatars: readonly string[];
  additionalCount?: number;
};

export default function AuctionNote({
  message,
  avatars,
  additionalCount = 0,
}: AuctionNoteProps) {
  return (
    <aside className="auction-note" aria-label="Live auction update">
      <strong>Live Auction</strong>
      <p>{message}</p>
      <AvatarStack
        images={avatars}
        additionalCount={additionalCount}
        label={`${avatars.length + additionalCount} buyers watching`}
      />
    </aside>
  );
}