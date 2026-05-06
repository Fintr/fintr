# frozen_string_literal: true

require "rails_helper"

RSpec.describe MonthlyFinancialSummaries::Queries::DateRangeSummary, type: :query do
  include Dry::Monads[:result]

  let!(:space) { create(:personal_space, code: "test-space") }
  let!(:other_space) { create(:personal_space, code: "other-space") }

  let(:valid_params) do
    {
      space_code: space.code,
      start_date: "2024-01-01",
      end_date: "2024-01-31"
    }
  end

  describe "#validate" do
    context "when params are valid" do
      subject(:validation_result) { described_class.new(params: valid_params).validate(valid_params) }

      it "returns a success" do
        expect(validation_result).to be_success
      end

      it "returns the validated params hash" do
        expect(validation_result.value!).to eq(valid_params)
      end
    end

    context "when space_code is missing" do
      subject(:validation_result) do
        described_class.new(params: {}).validate(
          { start_date: "2024-01-01", end_date: "2024-01-31" }
        )
      end

      it "returns a failure" do
        expect(validation_result).to be_failure
      end

      it "includes :space_code in failure details" do
        expect(validation_result.failure).to include(space_code: ["is missing"])
      end
    end

    context "when start_date is missing" do
      subject(:validation_result) do
        described_class.new(params: valid_params.except(:start_date)).validate(
          valid_params.except(:start_date)
        )
      end

      it "returns a failure" do
        expect(validation_result).to be_failure
      end

      it "includes :start_date in failure details" do
        expect(validation_result.failure).to include(start_date: ["is missing"])
      end
    end

    context "when end_date is missing" do
      subject(:validation_result) do
        described_class.new(params: valid_params.except(:end_date)).validate(
          valid_params.except(:end_date)
        )
      end

      it "returns a failure" do
        expect(validation_result).to be_failure
      end

      it "includes :end_date in failure details" do
        expect(validation_result.failure).to include(end_date: ["is missing"])
      end
    end

    context "when space_code is not a string" do
      subject(:validation_result) do
        described_class.new(params: invalid_params).validate(invalid_params)
      end

      let(:invalid_params) { valid_params.merge(space_code: 123) }

      it "returns a failure" do
        expect(validation_result).to be_failure
      end

      it "includes :space_code type error in failure details" do
        expect(validation_result.failure).to include(space_code: ["must be a string"])
      end
    end
  end

  describe "#call" do
    subject(:query_result) { described_class.new(params: query_params).call }

    context "with valid params and single month range" do
      let(:query_params) { valid_params }

      it "succeeds" do
        expect(query_result).to be_success
      end

      it "returns an OpenStruct summary" do
        summary = query_result.value!
        expect(summary).to be_a(OpenStruct)
        expect(summary).to respond_to(:total_income, :total_expenses, :net_savings, :savings_percentage, :calculated_at)
      end

      it "returns zero totals when no transactions exist" do
        summary = query_result.value!
        expect(summary.total_income).to eq(0.0)
        expect(summary.total_expenses).to eq(0.0)
        expect(summary.net_savings).to eq(0.0)
      end

      it "returns zero savings_percentage when no income" do
        summary = query_result.value!
        expect(summary.savings_percentage).to eq(0.0)
      end
    end

    context "when space does not exist" do
      let(:query_params) do
        valid_params.merge(space_code: "non-existent-space")
      end

      it "returns a failure" do
        expect(query_result).to be_failure
      end

      it "returns space_code error" do
        expect(query_result.failure).to include(space_code: "Space not found")
      end
    end

    context "when start_date is after end_date" do
      let(:query_params) do
        valid_params.merge(start_date: "2024-02-01", end_date: "2024-01-15")
      end

      it "returns a failure" do
        expect(query_result).to be_failure
      end

      it "returns date error" do
        expect(query_result.failure).to include(date: "start_date must be before or equal to end_date")
      end
    end

    context "when start_date has invalid format" do
      let(:query_params) do
        valid_params.merge(start_date: "not-a-date")
      end

      it "returns a failure" do
        expect(query_result).to be_failure
      end

      it "returns date error with invalid format message" do
        expect(query_result.failure).to include(date: "Invalid date format")
      end
    end

    context "when validation fails" do
      let(:query_params) { valid_params.merge(space_code: nil) }

      it "returns a failure" do
        expect(query_result).to be_failure
      end

      it "returns validation errors" do
        expect(query_result.failure).to include(space_code: ["must be a string"])
      end
    end

    context "with multi-month range mixing partial and cached months" do
      let(:query_params) do
        {
          space_code: space.code,
          start_date: "2024-01-10",
          end_date: "2024-03-20"
        }
      end

      before do
        # Partial first month (January 10-31): transactions only
        create(
          :income_transaction,
          space: space,
          date: Time.zone.parse("2024-01-15"),
          amount: 100.0
        )
        create(
          :expense_transaction,
          space: space,
          date: Time.zone.parse("2024-01-17"),
          amount: 20.0
        )

        # Full middle month (February): cached monthly summary
        create(
          :monthly_financial_summary,
          space: space,
          year: 2024,
          month: 2,
          total_income: 500.0,
          total_expenses: 100.0,
          net_savings: 400.0
        )

        # Partial last month (March 1-20): transactions only
        create(
          :income_transaction,
          space: space,
          date: Time.zone.parse("2024-03-10"),
          amount: 300.0
        )
        create(
          :expense_transaction,
          space: space,
          date: Time.zone.parse("2024-03-15"),
          amount: 50.0
        )
      end

      it "combines partial months and cached full months into a single summary" do
        summary = query_result.value!

        # Jan (partial): +100 income, 20 expense
        # Feb (cached): +500 income, 100 expense
        # Mar (partial): +300 income, 50 expense
        expect(summary.total_income).to eq(900.0)
        expect(summary.total_expenses).to eq(170.0)
        expect(summary.net_savings).to eq(730.0)
        expect(summary.savings_percentage).to eq(81.11)
      end
    end
  end

  describe "Private Methods" do
    let(:query) { described_class.new(params: valid_params) }

    describe "#find_space" do
      it "finds existing space" do
        result = query.send(:find_space)
        expect(result).to be_success
        expect(result.value!).to eq(space)
      end

      it "fails when space not found" do
        query_with_invalid_space = described_class.new(params: { space_code: "non-existent" })
        result = query_with_invalid_space.send(:find_space)
        expect(result).to be_failure
        expect(result.failure).to include(space_code: "Space not found")
      end
    end

    describe "#parse_dates" do
      it "returns success with start_date and end_date when valid" do
        result = query.send(:parse_dates)
        expect(result).to be_success
        expect(result.value![:start_date]).to eq(Date.parse("2024-01-01"))
        expect(result.value![:end_date]).to eq(Date.parse("2024-01-31"))
      end

      it "fails when start_date is after end_date" do
        query_invalid_range = described_class.new(
          params: valid_params.merge(start_date: "2024-02-01", end_date: "2024-01-01")
        )
        result = query_invalid_range.send(:parse_dates)
        expect(result).to be_failure
        expect(result.failure).to include(date: "start_date must be before or equal to end_date")
      end

      it "fails when date string is invalid" do
        query_bad_date = described_class.new(
          params: valid_params.merge(start_date: "invalid")
        )
        result = query_bad_date.send(:parse_dates)
        expect(result).to be_failure
        expect(result.failure).to include(date: "Invalid date format")
      end
    end

    describe "#combine_totals" do
      it "sums total_income from first, last, and cache" do
        first = { total_income: 100.0, total_expenses: 20.0, net_savings: 80.0 }
        cache = { total_income: 200.0, total_expenses: 50.0, net_savings: 150.0 }
        result = query.send(:combine_totals, first:, last: nil, cache:)
        expect(result).to be_success
        expect(result.value![:total_income]).to eq(300.0)
      end

      it "sums total_expenses from first, last, and cache" do
        first = { total_income: 100.0, total_expenses: 20.0, net_savings: 80.0 }
        cache = { total_income: 200.0, total_expenses: 50.0, net_savings: 150.0 }
        result = query.send(:combine_totals, first:, last: nil, cache:)
        expect(result).to be_success
        expect(result.value![:total_expenses]).to eq(70.0)
      end

      it "computes net_savings as total_income minus total_expenses" do
        first = { total_income: 100.0, total_expenses: 20.0, net_savings: 80.0 }
        result = query.send(:combine_totals, first:, last: nil, cache: nil)
        expect(result).to be_success
        expect(result.value![:net_savings]).to eq(80.0)
      end
    end

    describe "#convert_to_numeric" do
      it "adds savings_percentage when total_income is positive" do
        totals = { total_income: 100.0, total_expenses: 20.0, net_savings: 80.0 }
        result = query.send(:convert_to_numeric, totals:)
        expect(result).to be_success
        expect(result.value![:savings_percentage]).to eq(80.0)
      end

      it "sets savings_percentage to 0 when total_income is zero" do
        totals = { total_income: 0.0, total_expenses: 0.0, net_savings: 0.0 }
        result = query.send(:convert_to_numeric, totals:)
        expect(result).to be_success
        expect(result.value![:savings_percentage]).to eq(0.0)
      end
    end

    describe "#build_summary" do
      it "returns an OpenStruct with numeric values and calculated_at" do
        numeric_values = {
          total_income: 100.0,
          total_expenses: 30.0,
          net_savings: 70.0,
          savings_percentage: 70.0
        }
        result = query.send(:build_summary, numeric_values:)
        expect(result).to be_success
        summary = result.value!
        expect(summary.total_income).to eq(100.0)
        expect(summary.total_expenses).to eq(30.0)
        expect(summary.net_savings).to eq(70.0)
        expect(summary.savings_percentage).to eq(70.0)
        expect(summary.calculated_at).to be_within(2).of(Time.current)
      end
    end
  end
end
