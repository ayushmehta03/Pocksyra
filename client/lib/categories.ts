// Must match the categories the API accepts (backend/internal/expenses).
export const CATEGORIES = [
  { id: "food", label: "Food & drink" },
  { id: "groceries", label: "Groceries" },
  { id: "transport", label: "Transport" },
  { id: "rent", label: "Rent" },
  { id: "utilities", label: "Utilities" },
  { id: "entertainment", label: "Entertainment" },
  { id: "travel", label: "Travel" },
  { id: "shopping", label: "Shopping" },
  { id: "health", label: "Health" },
  { id: "other", label: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const categoryLabel = (id: string): string => CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
