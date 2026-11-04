import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3 p-8 text-center">
      <h1 className="m-0 text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="font-semibold text-indigo">
        Go to the start
      </Link>
    </section>
  );
}
