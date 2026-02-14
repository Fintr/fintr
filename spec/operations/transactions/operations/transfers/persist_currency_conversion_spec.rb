# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::Transfers::PersistCurrencyConversion do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, space:, balance: Money.from_amount(500, "PHP")) }
  let(:transfer) do
    create(
      :transfer,
      space:,
      from_account:,
      to_account:,
      amount: Money.from_amount(100, "PHP")
    )
  end

  # Operation may return Success(transfer) or transfer; unwrap for comparison
  def unwrap_result(result)
    v = result.value!
    v.respond_to?(:value!) && v.success? ? v.value! : v
  end

  describe "#call" do
    context "when only transfer is passed (no conversion_data or params)" do
      it "returns success with the transfer" do
        result = operation.call(transfer:)
        expect(result).to be_success
        expect(unwrap_result(result)).to eq(transfer)
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

        it "returns success with transfer without calling UpsertCurrencyConversion" do
          upsert_op = instance_double(ExchangeRates::Operations::UpsertCurrencyConversion)
          allow(upsert_op).to receive(:call)
          allow(ExchangeRates::Operations::UpsertCurrencyConversion).to receive(:new).and_return(upsert_op)

          result = operation.call(transfer:, conversion_data:)

          expect(result).to be_success
          expect(unwrap_result(result)).to eq(transfer)
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

        it "calls UpsertCurrencyConversion and returns success with transfer" do
          upsert_op = instance_double(ExchangeRates::Operations::UpsertCurrencyConversion, call: Success(transfer))
          allow(ExchangeRates::Operations::UpsertCurrencyConversion).to receive(:new).and_return(upsert_op)

          result = operation.call(transfer:, conversion_data:)

          expect(result).to be_success
          expect(unwrap_result(result)).to eq(transfer)
          expect(upsert_op).to have_received(:call).with(
            hash_including(
              convertible: transfer,
              space_id: transfer.space_id,
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

    context "when params, from_account, and to_account are present" do
      context "when exchange_rate is blank" do
        it "returns success with transfer without calling UpsertCurrencyConversion" do
          upsert_op = instance_double(ExchangeRates::Operations::UpsertCurrencyConversion)
          allow(upsert_op).to receive(:call)
          allow(ExchangeRates::Operations::UpsertCurrencyConversion).to receive(:new).and_return(upsert_op)

          result = operation.call(
            transfer:,
            params: { original_currency: "USD", amount: 100 },
            from_account:,
            to_account:
          )

          expect(result).to be_success
          expect(unwrap_result(result)).to eq(transfer)
          expect(upsert_op).not_to have_received(:call)
        end
      end

      context "when from and to account currencies are the same" do
        it "returns success with transfer without calling UpsertCurrencyConversion" do
          upsert_op = instance_double(ExchangeRates::Operations::UpsertCurrencyConversion)
          allow(upsert_op).to receive(:call)
          allow(ExchangeRates::Operations::UpsertCurrencyConversion).to receive(:new).and_return(upsert_op)

          result = operation.call(
            transfer:,
            params: { original_currency: "PHP", exchange_rate: 1.0, amount: 100 },
            from_account:,
            to_account:
          )

          expect(result).to be_success
          expect(unwrap_result(result)).to eq(transfer)
          expect(upsert_op).not_to have_received(:call)
        end
      end

      context "when different currencies and rate provided" do
        let(:from_account_usd) { create(:account, space:, balance: Money.from_amount(100, "USD")) }
        let(:to_account_php) { create(:account, space:, balance: Money.from_amount(500, "PHP")) }
        let(:transfer_multi) do
          build(
            :transfer,
            space:,
            from_account: from_account_usd,
            to_account: to_account_php,
            amount: Money.from_amount(5500, "PHP")
          ).tap { |t| t.save!(validate: false) }
        end

        it "calls UpsertCurrencyConversion and returns success with transfer" do
          upsert_op = instance_double(
            ExchangeRates::Operations::UpsertCurrencyConversion,
            call: Success(transfer_multi)
          )
          allow(ExchangeRates::Operations::UpsertCurrencyConversion).to receive(:new).and_return(upsert_op)

          result = operation.call(
            transfer: transfer_multi,
            params: {
              original_currency: "USD",
              exchange_rate: 55.0,
              amount: 5500,
              exchange_rate_source: "manual"
            },
            from_account: from_account_usd,
            to_account: to_account_php
          )

          expect(result).to be_success
          expect(unwrap_result(result)).to eq(transfer_multi)
          expect(upsert_op).to have_received(:call).with(
            hash_including(
              convertible: transfer_multi,
              space_id: transfer_multi.space_id,
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
          transfer:,
          conversion_data: { needs_conversion: true, source: "invalid" }
        )
        expect(result).to be_failure
        expect(result.failure).to be_present
      end
    end
  end
end
