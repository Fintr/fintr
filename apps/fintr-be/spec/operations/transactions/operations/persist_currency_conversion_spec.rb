# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::PersistCurrencyConversion do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let(:account) { create(:account, space:, balance: Money.from_amount(100, "PHP")) }
  let(:transaction) { create(:transaction, space:, account:, balance: Money.from_amount(100, "PHP")) }

  # Operation may return Success(transaction) or transaction; unwrap for comparison
  def unwrap_result(result)
    v = result.value!
    v.respond_to?(:value!) && v.success? ? v.value! : v
  end

  describe "#call" do
    context "when only transaction is passed (no conversion_data or params)" do
      it "returns success with the transaction" do
        result = operation.call(transaction:)
        expect(result).to be_success
        expect(unwrap_result(result)).to eq(transaction)
      end
    end

    context "when conversion_data is present" do
      context "when needs_conversion is false" do
        let(:conversion_data) do
          {
            needs_conversion: false,
            original_amount: 100,
            original_currency: "USD",
            converted_amount: 100,
            converted_currency: "PHP",
            exchange_rate: 1.0,
            source: "manual"
          }
        end

        it "returns success with transaction without calling UpsertCurrencyConversion" do
          upsert_op = instance_double(ExchangeRates::Operations::UpsertCurrencyConversion)
          allow(upsert_op).to receive(:call)
          allow(ExchangeRates::Operations::UpsertCurrencyConversion).to receive(:new).and_return(upsert_op)

          result = operation.call(transaction:, conversion_data:)

          expect(result).to be_success
          expect(unwrap_result(result)).to eq(transaction)
          expect(upsert_op).not_to have_received(:call)
        end
      end

      context "when needs_conversion is true" do
        let(:conversion_data) do
          {
            needs_conversion: true,
            original_amount: 100,
            original_currency: "USD",
            converted_amount: 5500,
            converted_currency: "PHP",
            exchange_rate: 55.0,
            source: "auto",
            rate_timestamp: Time.current
          }
        end

        it "calls UpsertCurrencyConversion and returns success with transaction" do
          upsert_op = instance_double(ExchangeRates::Operations::UpsertCurrencyConversion, call: Success(transaction))
          allow(ExchangeRates::Operations::UpsertCurrencyConversion).to receive(:new).and_return(upsert_op)

          result = operation.call(transaction:, conversion_data:)

          expect(result).to be_success
          expect(unwrap_result(result)).to eq(transaction)
          expect(upsert_op).to have_received(:call).with(
            hash_including(
              convertible: transaction,
              space_id: transaction.space_id,
              original_amount: 100,
              original_currency: "USD",
              converted_amount: 5500,
              converted_currency: "PHP",
              exchange_rate: 55.0,
              source: "auto"
            )
          )
        end
      end
    end

    context "when params and account are present" do
      context "when exchange_rate is blank" do
        it "returns the transaction without calling UpsertCurrencyConversion" do
          upsert_op = instance_double(ExchangeRates::Operations::UpsertCurrencyConversion)
          allow(upsert_op).to receive(:call)
          allow(ExchangeRates::Operations::UpsertCurrencyConversion).to receive(:new).and_return(upsert_op)

          result = operation.call(
            transaction:,
            params: { original_currency: "USD", amount: 100 },
            account:
          )

          expect(result).to be_success
          expect(unwrap_result(result)).to eq(transaction)
          expect(upsert_op).not_to have_received(:call)
        end
      end

      context "when original_currency equals account currency" do
        it "returns the transaction without calling UpsertCurrencyConversion" do
          upsert_op = instance_double(ExchangeRates::Operations::UpsertCurrencyConversion)
          allow(upsert_op).to receive(:call)
          allow(ExchangeRates::Operations::UpsertCurrencyConversion).to receive(:new).and_return(upsert_op)

          result = operation.call(
            transaction:,
            params: {
              original_currency: "PHP",
              exchange_rate: 1.0,
              amount: 100
            },
            account:
          )

          expect(result).to be_success
          expect(unwrap_result(result)).to eq(transaction)
          expect(upsert_op).not_to have_received(:call)
        end
      end

      context "when different currency and rate provided" do
        it "calls UpsertCurrencyConversion and returns success with transaction" do
          upsert_op = instance_double(ExchangeRates::Operations::UpsertCurrencyConversion, call: Success(transaction))
          allow(ExchangeRates::Operations::UpsertCurrencyConversion).to receive(:new).and_return(upsert_op)

          result = operation.call(
            transaction:,
            params: {
              original_currency: "USD",
              exchange_rate: 55.0,
              amount: 5500,
              exchange_rate_source: "manual"
            },
            account:
          )

          expect(result).to be_success
          expect(unwrap_result(result)).to eq(transaction)
          expect(upsert_op).to have_received(:call).with(
            hash_including(
              convertible: transaction,
              space_id: transaction.space_id,
              original_currency: "USD",
              converted_currency: "PHP",
              exchange_rate: 55.0,
              source: "manual"
            )
          )
        end
      end
    end

    context "when contract validation fails" do
      it "returns Failure with errors when conversion_data has invalid source" do
        result = operation.call(
          transaction:,
          conversion_data: { needs_conversion: true, source: "invalid" }
        )
        expect(result).to be_failure
        expect(result.failure).to be_present
      end
    end
  end
end
