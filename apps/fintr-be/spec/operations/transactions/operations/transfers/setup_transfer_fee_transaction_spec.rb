# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::SetupTransferFeeTransaction do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:transfer) do
    create(:transfer,
           user:,
           space:,
           from_account:,
           to_account:,
           amount: Money.from_amount(100, "PHP"),
           transaction_cost: Money.from_amount(10, "PHP"),
           date: Time.zone.today,
           schedule_type: "one_time",
           description: "Monthly transfer")
  end
  let(:fee_category) { create(:category, name: "Transfer Fee", space:, category_type: "expense") }

  describe '#validate' do
    context 'with valid parameters' do
      it 'succeeds when balance_state is pending' do
        result = operation.validate(params: { balance_state: "pending" })
        expect(result).to be_success
        expect(result.value![:balance_state]).to eq("pending")
      end

      it 'succeeds when balance_state is calculated' do
        result = operation.validate(params: { balance_state: "calculated" })
        expect(result).to be_success
        expect(result.value![:balance_state]).to eq("calculated")
      end
    end

    context 'with invalid parameters' do
      it 'fails when balance_state is invalid' do
        result = operation.validate(params: { balance_state: "invalid_state" })
        expect(result).to be_failure
        expect(result.failure[:error][:balance_state]).to include("must be 'pending' or 'calculated'")
      end

      it 'fails when balance_state is nil' do
        result = operation.validate(params: { balance_state: nil })
        expect(result).to be_failure
        expect(result.failure[:error]).to include(:balance_state)
      end
    end
  end

  describe '#call' do
    context 'with valid parameters' do
      let(:valid_params) { { balance_state: "calculated" } }

      it 'initializes fee transaction successfully' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction).to be_a(Transactions::Expense)
      end

      it 'sets correct user_id on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.user_id).to eq(transfer.user_id)
      end

      it 'sets correct space_id on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.space_id).to eq(transfer.space_id)
      end

      it 'sets correct account_id on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.account_id).to eq(transfer.from_account_id)
      end

      it 'sets correct category_id on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.category_id).to eq(fee_category.id)
      end

      it 'sets correct transfer_id on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.transfer_id).to eq(transfer.id)
      end

      it 'sets correct amount on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.amount).to eq(transfer.transaction_cost)
      end

      it 'sets correct amount_currency on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.amount_currency).to eq(transfer.transaction_cost_currency)
      end

      it 'sets correct date on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.date).to eq(transfer.date)
      end

      it 'sets correct description on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expected_description = "Transfer ID: #{transfer.id}, Transfer fee for: #{transfer.description}"
        expect(fee_transaction.description).to eq(expected_description)
      end

      it 'sets correct balance_state on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.balance_state).to eq("calculated")
      end

      it 'sets correct schedule_type on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.schedule_type).to eq(transfer.schedule_type)
      end

      it 'sets balance_cents to 0 on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.balance_cents).to eq(0)
      end

      it 'sets correct repeat_interval on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.repeat_interval).to eq(transfer.repeat_interval)
      end

      it 'sets correct repeat_count on fee transaction' do
        result = operation.call(params: valid_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.repeat_count).to eq(transfer.repeat_count)
      end
    end

    context 'with pending balance_state' do
      let(:pending_params) { { balance_state: "pending" } }

      it 'sets balance_state to pending on fee transaction' do
        result = operation.call(params: pending_params, transfer:, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.balance_state).to eq("pending")
      end
    end

    context 'with repeat transfer' do
      let(:repeat_transfer) do
        create(:transfer,
               :repeat,
               user:,
               space:,
               from_account:,
               to_account:,
               amount: Money.from_amount(100, "PHP"),
               transaction_cost: Money.from_amount(10, "PHP"),
               date: Time.zone.today,
               schedule_type: "repeat",
               repeat_interval: "every_month",
               repeat_count: 3,
               description: "Monthly transfer")
      end
      let(:valid_params) { { balance_state: "calculated" } }

      it 'sets correct repeat_interval on fee transaction' do
        result = operation.call(params: valid_params, transfer: repeat_transfer, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.repeat_interval).to eq("every_month")
      end

      it 'sets correct repeat_count on fee transaction' do
        result = operation.call(params: valid_params, transfer: repeat_transfer, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expect(fee_transaction.repeat_count).to eq(3)
      end
    end

    context 'with transfer having no description' do
      let(:transfer_no_description) do
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               amount: Money.from_amount(100, "PHP"),
               transaction_cost: Money.from_amount(10, "PHP"),
               date: Time.zone.today,
               schedule_type: "one_time",
               description: nil)
      end
      let(:valid_params) { { balance_state: "calculated" } }

      it 'handles nil description correctly' do
        result = operation.call(params: valid_params, transfer: transfer_no_description, fee_category:)
        expect(result).to be_success

        fee_transaction = result.value!
        expected_description = "Transfer ID: #{transfer_no_description.id}, Transfer fee for: "
        expect(fee_transaction.description).to eq(expected_description)
      end
    end

    context 'with invalid parameters' do
      it 'fails validation when balance_state is invalid' do
        result = operation.call(params: { balance_state: "invalid" }, transfer:, fee_category:)
        expect(result).to be_failure
        expect(result.failure[:error][:balance_state]).to include("must be 'pending' or 'calculated'")
      end
    end
  end

  describe '#initialize_fee_transaction' do
    let(:valid_params) { { balance_state: "calculated" } }

    it 'creates a new Expense transaction' do
      result = operation.send(:initialize_fee_transaction, params: valid_params, transfer:, fee_category:)
      expect(result).to be_success

      fee_transaction = result.value!
      expect(fee_transaction).to be_a(Transactions::Expense)
    end

    it 'returns success with the fee transaction' do
      result = operation.send(:initialize_fee_transaction, params: valid_params, transfer:, fee_category:)
      expect(result).to be_success
      expect(result.value!).to be_a(Transactions::Expense)
    end

    it 'sets all required attributes on the fee transaction' do
      result = operation.send(:initialize_fee_transaction, params: valid_params, transfer:, fee_category:)
      expect(result).to be_success

      fee_transaction = result.value!
      expect(fee_transaction.user_id).to eq(transfer.user_id)
      expect(fee_transaction.space_id).to eq(transfer.space_id)
      expect(fee_transaction.account_id).to eq(transfer.from_account_id)
      expect(fee_transaction.category_id).to eq(fee_category.id)
      expect(fee_transaction.transfer_id).to eq(transfer.id)
      expect(fee_transaction.amount).to eq(transfer.transaction_cost)
      expect(fee_transaction.amount_currency).to eq(transfer.transaction_cost_currency)
      expect(fee_transaction.date).to eq(transfer.date)
      expect(fee_transaction.balance_state).to eq("calculated")
      expect(fee_transaction.schedule_type).to eq(transfer.schedule_type)
      expect(fee_transaction.balance_cents).to eq(0)
      expect(fee_transaction.repeat_interval).to eq(transfer.repeat_interval)
      expect(fee_transaction.repeat_count).to eq(transfer.repeat_count)
    end
  end
end
