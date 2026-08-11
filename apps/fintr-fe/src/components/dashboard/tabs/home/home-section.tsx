import Link from "next/link";
import { ChevronRight } from "lucide-react";

type HomeSectionProps = {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
};

export const HomeSection = ({
  title,
  href,
  linkLabel = "See all",
  children,
}: HomeSectionProps) => {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-primary">{title}</h2>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary/70 transition-colors hover:text-primary"
          >
            {linkLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
};
