import Link from "next/link";

type PaginationControlsProps = {
  basePath: string;
  page: number;
  totalPages: number;
  ariaLabel?: string;
};

export function PaginationControls({
  basePath,
  page,
  totalPages,
  ariaLabel = "Pagination",
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return null;
  }

  const previousPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  return (
    <nav className="pagination" aria-label={ariaLabel}>
      {previousPage ? (
        <Link className="pagination-link" href={buildPageHref(basePath, previousPage)}>
          Previous
        </Link>
      ) : (
        <span className="pagination-link disabled" aria-disabled="true">
          Previous
        </span>
      )}
      <p className="pagination-status">
        Page {page} of {totalPages}
      </p>
      {nextPage ? (
        <Link className="pagination-link" href={buildPageHref(basePath, nextPage)}>
          Next
        </Link>
      ) : (
        <span className="pagination-link disabled" aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}

function buildPageHref(basePath: string, page: number) {
  const normalizedBasePath = normalizeBasePath(basePath);

  if (page <= 1) {
    return normalizedBasePath;
  }

  const separator = normalizedBasePath.includes("?") ? "&" : "?";

  return `${normalizedBasePath}${separator}page=${page}`;
}

function normalizeBasePath(basePath: string) {
  if (basePath === "/") {
    return "/";
  }

  return basePath.replace(/\/+$/, "");
}
