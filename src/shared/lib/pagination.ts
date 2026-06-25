export const DEFAULT_PAGE_SIZE = 10;

export function parsePageParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const page = Number(rawValue);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function getTotalPages(totalItems: number, pageSize = DEFAULT_PAGE_SIZE) {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

export function getPaginationState({
  page,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  page: number;
  totalItems: number;
  pageSize?: number;
}) {
  const totalPages = getTotalPages(totalItems, pageSize);
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  return {
    currentPage,
    pageSize,
    totalPages,
    skip: (currentPage - 1) * pageSize,
    canPrevious: currentPage > 1,
    canNext: currentPage < totalPages,
  };
}
