export function syncDocumentScreenClass(
  className: string,
  isActive: boolean,
): () => void {
  if (typeof document === "undefined") {
    return () => undefined;
  }

  if (isActive) {
    document.documentElement.classList.add(className);
  } else {
    document.documentElement.classList.remove(className);
  }

  return () => {
    document.documentElement.classList.remove(className);
  };
}
