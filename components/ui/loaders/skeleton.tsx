type SkeletonProps = {
  className?: string;
  rounded?: "control" | "card" | "pill" | "none";
};

export default function Skeleton({ className, rounded = "control" }: SkeletonProps) {
  const roundedClass =
    rounded === "card"
      ? "ui-skeleton--card"
      : rounded === "pill"
        ? "ui-skeleton--pill"
        : rounded === "none"
          ? ""
          : "ui-skeleton--control";

  return (
    <span
      className={["ui-skeleton", roundedClass, className].filter(Boolean).join(" ")}
      aria-hidden="true"
    />
  );
}
