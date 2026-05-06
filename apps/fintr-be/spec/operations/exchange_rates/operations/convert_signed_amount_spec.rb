# frozen_string_literal: true

require "rails_helper"

RSpec.describe ExchangeRates::Operations::ConvertSignedAmount do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let(:rate_date) { Date.current }

  describe "#call" do
    context "when from and to currency are the same" do
      it "returns the amount unchanged" do
        result = operation.call(
          amount: BigDecimal("-75.5"),
          from_currency: "PHP",
          to_currency: "PHP",
          space_id: space.id,
          date: rate_date
        )

        expect(result).to be_success
        expect(result.value![:amount]).to eq(BigDecimal("-75.5"))
      end
    end

    context "when converting between different currencies" do
      before do
        ExchangeRates::ApiExchangeRate.create!(
          base_currency: ExchangeRates::ApiExchangeRate::BASE_CURRENCY,
          target_currency: "PHP",
          rate: 58,
          rate_date: rate_date
        )
      end

      it "converts using FetchRate (amount_to = amount_from * rate)" do
        result = operation.call(
          amount: BigDecimal("100"),
          from_currency: "PHP",
          to_currency: "USD",
          space_id: space.id,
          date: rate_date
        )

        expect(result).to be_success
        expected = (BigDecimal("100") / BigDecimal("58")).round(2)
        expect(result.value![:amount]).to eq(expected)
      end

      it "preserves sign for expenses" do
        result = operation.call(
          amount: BigDecimal("-100"),
          from_currency: "PHP",
          to_currency: "USD",
          space_id: space.id,
          date: rate_date
        )

        expect(result).to be_success
        expected = (BigDecimal("-100") / BigDecimal("58")).round(2)
        expect(result.value![:amount]).to eq(expected)
      end
    end
  end
end
