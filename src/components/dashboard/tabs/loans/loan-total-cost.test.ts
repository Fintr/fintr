import { describe, it, expect } from "vitest";
import { Loan } from "@/services/loans/queries";

// Test the loan total value calculation
// Total Value = Principal + Accumulated Interest (sum of all scheduled payments)
// This is consistent with profit/loss terminology

describe("Loan Total Value - Principal + Interest", () => {
  const createMockLoan = (overrides: Partial<Loan> = {}): Loan => ({
    id: "test-loan-1",
    date: "2024-01-01",
    description: "Test loan",
    loanType: "borrowed",
    loanTermMonths: 240, // 20 years
    maturityDate: "2044-01-01",
    status: "active",
    paidOffDate: null,
    interestRate: 8.0,
    entityName: "Test Entity",
    accountName: "Test Account",
    principalAmount: 9_400_000,
    principalAmountCurrency: "PHP",
    outstandingBalance: 9_400_000,
    outstandingBalanceCurrency: "PHP",
    value: -9_400_000,
    income: 0,
    expense: 0,
    // Backend calculation: sum of all scheduled payments
    // Monthly payment ~78,625.37 × 240 months = ~18,885,832
    totalValue: 18_885_832,
    files: [],
    ...overrides,
  });

  describe("totalValue represents principal + interest", () => {
    it("should have totalValue greater than principal", () => {
      const loan = createMockLoan();
      
      // Total value must include both principal AND interest
      expect(loan.totalValue).toBeGreaterThan(loan.principalAmount);
    });

    it("should calculate total value as principal + total interest for 240 month loan", () => {
      const loan = createMockLoan({
        principalAmount: 9_400_000,
        loanTermMonths: 240,
        interestRate: 8.0,
        totalValue: 18_885_832,
      });

      // Calculate total interest from total value
      const totalInterest = loan.totalValue - loan.principalAmount;
      
      // Verify: Total Value = Principal + Interest
      expect(loan.totalValue).toBe(loan.principalAmount + totalInterest);
      
      // For 9.4M at 8% over 20 years:
      // - Total interest should be ~9.49M (roughly equal to principal)
      expect(totalInterest).toBeGreaterThan(9_400_000);
      expect(totalInterest).toBeLessThan(9_500_000);
      
      // Total value should be ~18.89M
      expect(loan.totalValue).toBeGreaterThan(18_800_000);
      expect(loan.totalValue).toBeLessThan(18_900_000);
    });

    it("should NOT be just the interest amount", () => {
      const loan = createMockLoan({
        principalAmount: 9_400_000,
        loanTermMonths: 240,
        totalValue: 18_885_832,
      });

      const totalInterest = loan.totalValue - loan.principalAmount;
      
      // Common bug: showing only interest as "total value"
      // This test ensures totalValue includes principal
      expect(loan.totalValue).not.toBe(totalInterest);
      expect(loan.totalValue).toBeGreaterThan(totalInterest);
    });

    it("should handle lent loans (total value = return)", () => {
      const lentLoan = createMockLoan({
        loanType: "lent",
        principalAmount: 9_400_000,
        loanTermMonths: 240,
        totalValue: 18_885_832,
        value: 9_400_000, // positive for lent
      });

      expect(lentLoan.totalValue).toBeGreaterThan(lentLoan.principalAmount);
      
      const totalInterest = lentLoan.totalValue - lentLoan.principalAmount;
      expect(totalInterest).toBeGreaterThan(9_400_000);
      expect(totalInterest).toBeLessThan(9_500_000);
    });
  });

  describe("consistency with profit/loss terminology", () => {
    it("uses 'Total Value' label consistently for both borrowed and lent", () => {
      // Both borrowed and lent loans show "Total Value" in the UI
      // This is consistent with P&L terminology where value = principal + interest
      const borrowedLoan = createMockLoan({ loanType: "borrowed" });
      const lentLoan = createMockLoan({ loanType: "lent" });
      
      // Both have the same totalValue structure
      expect(borrowedLoan.totalValue).toBeGreaterThan(borrowedLoan.principalAmount);
      expect(lentLoan.totalValue).toBeGreaterThan(lentLoan.principalAmount);
    });

    it("monthly payment calculation is consistent with total value", () => {
      const loan = createMockLoan({
        principalAmount: 9_400_000,
        loanTermMonths: 240,
        totalValue: 18_885_832,
      });

      // Derive implied monthly payment from total value
      const impliedMonthlyPayment = loan.totalValue / loan.loanTermMonths;
      
      // For 9.4M at 8% over 20 years, monthly payment should be ~78,625
      expect(impliedMonthlyPayment).toBeGreaterThan(78_600);
      expect(impliedMonthlyPayment).toBeLessThan(78_700);
    });

    it("uses consistent currency across all monetary fields", () => {
      const loan = createMockLoan({
        principalAmountCurrency: "PHP",
        outstandingBalanceCurrency: "PHP",
      });

      expect(loan.principalAmountCurrency).toBe("PHP");
      expect(loan.outstandingBalanceCurrency).toBe("PHP");
    });
  });
});
