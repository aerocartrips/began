import Spinner from "@/components/ui/loaders/spinner";

type PageLoaderProps = {
  label?: string;
};

export default function PageLoader({ label = "Loading page" }: PageLoaderProps) {
  return (
    <div className="ui-page-loader content-width" role="status" aria-live="polite" aria-busy="true">
      <Spinner size="lg" label={label} />
      <p>{label}</p>
    </div>
  );
}
