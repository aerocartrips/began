import Skeleton from "@/components/ui/loaders/Skeleton";

export default function ImageSkeleton({ className }: { className?: string }) {
  return <Skeleton className={["ui-image-skeleton", className].filter(Boolean).join(" ")} rounded="control" />;
}
