export function formatDate(iso: string, timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone }).format(new Date(iso));
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.name === "ApiError") return err.message;
  if (err instanceof TypeError) return "Can't reach Setu Retail. Check the internet connection and try again.";
  return "Something went wrong. Please try again.";
}
