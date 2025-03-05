export function stripTrailingSlash<T extends string | undefined>(str: T): T {
  return str?.endsWith("/") ? (str.slice(0, -1) as T) : str;
}
