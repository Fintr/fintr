# frozen_string_literal: true

require "rails_helper"

RSpec.describe Utils::InstallmentPlan do
  describe ".occurrence_dates" do
    it "returns monthly dates through the installment term" do
      parent_date = Date.new(2026, 1, 1)

      dates = described_class.occurrence_dates(
        parent_date:,
        period: 3,
      )

      expect(dates).to eq(
        [
          Date.new(2026, 1, 1),
          Date.new(2026, 2, 1),
          Date.new(2026, 3, 1),
        ],
      )
    end

    it "filters dates before the effective date" do
      parent_date = Date.new(2026, 1, 1)

      dates = described_class.occurrence_dates(
        parent_date:,
        period: 3,
        from_date: Date.new(2026, 2, 1),
      )

      expect(dates).to eq(
        [
          Date.new(2026, 2, 1),
          Date.new(2026, 3, 1),
        ],
      )
    end
  end

  describe ".compute_revision" do
    let(:parent_date) { Date.new(2026, 1, 1) }

    it "keeps total when extending the term with no payments recorded" do
      result = described_class.compute_revision(
        installment_total_cents: 120_000,
        currency: "PHP",
        new_period: 14,
        parent_date:,
        effective_date: parent_date,
        anchor: "total",
        paid_so_far_cents: 0,
      )

      expect(result).to be_success
      expect(result.value![:installment_total_cents]).to eq(120_000)
      expect(result.value![:per_payment]).to eq(BigDecimal("85.71"))
      expect(result.value![:remaining_count]).to eq(14)
    end

    it "keeps monthly when extending the term with no payments recorded" do
      result = described_class.compute_revision(
        installment_total_cents: 120_000,
        currency: "PHP",
        new_period: 14,
        parent_date:,
        effective_date: parent_date,
        anchor: "monthly",
        paid_so_far_cents: 0,
        new_monthly_cents: 10_000,
      )

      expect(result).to be_success
      expect(result.value![:installment_total_cents]).to eq(140_000)
      expect(result.value![:per_payment]).to eq(100.0)
    end

    it "redistributes remaining balance when some payments are calculated" do
      result = described_class.compute_revision(
        installment_total_cents: 120_000,
        currency: "PHP",
        new_period: 14,
        parent_date:,
        effective_date: Date.new(2026, 4, 1),
        anchor: "total",
        paid_so_far_cents: 30_000,
        prior_per_payment_cents: 10_000,
      )

      expect(result).to be_success
      expect(result.value![:remaining_count]).to eq(11)
      expect(result.value![:per_payment]).to eq(BigDecimal("81.82"))
    end

    it "keeps earlier unpaid months and revises only remaining payments" do
      result = described_class.compute_revision(
        installment_total_cents: 250_000,
        currency: "GBP",
        new_period: 24,
        parent_date:,
        effective_date: Date.new(2027, 11, 1),
        anchor: "total",
        paid_so_far_cents: 80_000,
        calculated_dates: [
          Date.new(2026, 1, 1),
          Date.new(2026, 2, 1),
          Date.new(2026, 3, 1),
          Date.new(2026, 4, 1),
          Date.new(2026, 5, 1),
          Date.new(2026, 6, 1),
          Date.new(2026, 7, 1),
          Date.new(2026, 8, 1),
        ],
        prior_per_payment_cents: 10_000,
      )

      expect(result).to be_success
      expect(result.value![:remaining_count]).to eq(2)
      expect(result.value![:per_payment]).to eq(BigDecimal("150.0"))
    end

    it "releases a this-only bump so 2500→2600 becomes 200 for the last 2 payments" do
      occurrence_cents_by_date = (0...24).each_with_object({}) do |index, lookup|
        date = parent_date + index.months
        lookup[date] = date == Date.new(2027, 11, 1) ? 20_000 : 10_000
      end

      result = described_class.compute_revision(
        installment_total_cents: 260_000,
        currency: "GBP",
        new_period: 24,
        parent_date:,
        effective_date: Date.new(2027, 11, 1),
        anchor: "total",
        paid_so_far_cents: 80_000,
        prior_per_payment_cents: 20_000,
        occurrence_cents_by_date:,
      )

      expect(result).to be_success
      expect(result.value![:remaining_count]).to eq(2)
      expect(result.value![:per_payment]).to eq(BigDecimal("200.0"))
      expect(result.value![:installment_total_cents]).to eq(260_000)
    end

    it "revises 18 remaining payments from a July reference date" do
      result = described_class.compute_revision(
        installment_total_cents: 250_000,
        currency: "GBP",
        new_period: 24,
        parent_date:,
        effective_date: Date.new(2026, 7, 1),
        anchor: "total",
        paid_so_far_cents: 0,
        calculated_dates: [
          Date.new(2026, 1, 1),
          Date.new(2026, 2, 1),
          Date.new(2026, 3, 1),
          Date.new(2026, 4, 1),
          Date.new(2026, 5, 1),
          Date.new(2026, 6, 1),
          Date.new(2026, 7, 1),
          Date.new(2026, 8, 1),
        ],
        prior_per_payment_cents: 10_000,
      )

      expect(result).to be_success
      expect(result.value![:remaining_count]).to eq(18)
      expect(result.value![:per_payment]).to eq(BigDecimal("105.56"))
    end

    it "revises 23 remaining payments from the 2nd installment" do
      result = described_class.compute_revision(
        installment_total_cents: 250_000,
        currency: "GBP",
        new_period: 24,
        parent_date:,
        effective_date: Date.new(2026, 2, 1),
        anchor: "total",
        paid_so_far_cents: 0,
        calculated_dates: [
          Date.new(2026, 1, 1),
          Date.new(2026, 2, 1),
        ],
        prior_per_payment_cents: 10_000,
      )

      expect(result).to be_success
      expect(result.value![:remaining_count]).to eq(23)
      expect(result.value![:per_payment]).to eq(BigDecimal("104.35"))
    end
  end

  describe ".commitment_total_cents" do
    it "uses actual occurrence amounts instead of monthly times term" do
      total = described_class.commitment_total_cents(
        parent_date: Date.new(2026, 1, 1),
        period: 24,
        default_per_payment_cents: 1_000_000,
        occurrence_cents_by_date: {
          Date.new(2026, 7, 1) => 5_000_000,
          Date.new(2027, 11, 1) => 2_000_000,
        },
      )

      expect(total).to eq(29_000_000)
    end
  end

  describe ".series_installment_total_amount" do
    it "prefers the root plan total over a stale child copy" do
      parent = create(
        :expense_transaction,
        :installment,
        amount: 10_000,
        installment_total_cents: 25_000_000,
        installment_period: 24,
      )
      child = create(
        :expense_transaction,
        :installment,
        parent:,
        amount: 10_000,
        installment_total_cents: 24_000_000,
        installment_period: 24,
      )

      expect(
        described_class.series_installment_total_amount(transaction: child),
      ).to eq(250_000)
    end
  end

  describe ".to_ledger_cents" do
    it "converts a GBP plan total into PHP cents at the stored rate" do
      expect(
        described_class.to_ledger_cents(
          amount: 2_700,
          from_currency: "GBP",
          ledger_currency: "PHP",
          exchange_rate: 100,
        ),
      ).to eq(27_000_000)
    end
  end
end
