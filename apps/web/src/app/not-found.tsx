import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link href="/" className="text-accent underline">
        See all tools
      </Link>
    </div>
  );
}
