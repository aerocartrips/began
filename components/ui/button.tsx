import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

const variants = {
  primary: "button button-primary",
  secondary: "button button-glass",
  portal: "portal-button",
  batch: "batch-action",
  form: "",
} as const;

type ButtonVariant = keyof typeof variants;
type LinkVariant = Exclude<ButtonVariant, "form">;

type CommonProps = {
  className?: string;
  children?: ReactNode;
  icon?: ReactNode;
};

type LinkButtonProps = CommonProps &
  Omit<ComponentProps<typeof Link>, "href" | "children" | "className"> & {
    href: ComponentProps<typeof Link>["href"];
    variant?: LinkVariant;
    type?: never;
  };

type NativeButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & {
    href?: never;
    variant?: ButtonVariant;
  };

type ButtonProps = LinkButtonProps | NativeButtonProps;

export default function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { href, variant = "primary", icon, className, children, ...linkProps } = props;
    const classes = [variants[variant], className].filter(Boolean).join(" ");

    return (
      <Link className={classes} href={href} {...linkProps}>
        {children}{icon}
      </Link>
    );
  }

  const {
    variant = "primary",
    icon,
    className,
    children,
    type = "button",
    ...buttonProps
  } = props;
  const classes = [variants[variant] ?? variants.primary, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} type={type} {...buttonProps}>
      {children}{icon}
    </button>
  );
}