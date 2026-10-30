import Spinner from "@/components/ui/loaders/Spinner";

type ButtonLoaderProps = {
  size?: "sm" | "md";
  label?: string;
};

export default function ButtonLoader({ size = "sm", label = "Processing" }: ButtonLoaderProps) {
  return <Spinner size={size} label={label} className="ui-button-loader" />;
}
