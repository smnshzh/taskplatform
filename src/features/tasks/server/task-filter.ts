export function getMultiValueFilter(
  searchParams: URLSearchParams,
  key: string
): string[] {
  return Array.from(
    new Set(
      searchParams
        .getAll(key)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export function getTaskSearchQuery(searchParams: URLSearchParams): string {
  return (searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
}
