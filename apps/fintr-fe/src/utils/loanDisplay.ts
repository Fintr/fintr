export const loanPurpose = (description?: string | null): string =>
  description?.trim() ?? "";

export const loanHeadline = (loan: {
  description?: string | null;
  entityName?: string | null;
}): string => loanPurpose(loan.description) || (loan.entityName?.trim() ?? "");

export const loanCounterparty = (loan: {
  description?: string | null;
  entityName?: string | null;
}): string => {
  const purpose = loanPurpose(loan.description);
  const entity = loan.entityName?.trim() ?? "";

  if (purpose && entity && purpose !== entity) {
    return entity;
  }

  return "";
};
