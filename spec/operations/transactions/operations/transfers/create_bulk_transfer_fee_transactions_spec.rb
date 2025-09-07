# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::CreateBulkTransferFeeTransactions do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let(:from_account) { create(:account, name: "Savings", space:, balance: Money.from_amount(1000, "PHP")) }
  let(:to_account) { create(:account, name: "Checking", space:, balance: Money.from_amount(500, "PHP")) }
  let(:parent_transfer) do
    create(:transfer, :repeat,
           user:,
           space:,
           from_account:,
           to_account:,
           amount: Money.from_amount(100, "PHP"),
           transaction_cost: Money.from_amount(10, "PHP"),
           date: Time.zone.today)
  end
  let(:dates) { [Time.zone.today + 1.month, Time.zone.today + 2.months] }
  let(:balance_state) { "calculated" }

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when parent_transfer_id is missing' do
        result = operation.validate(params: {
          dates: dates,
          balance_state: balance_state
        })
        expect(result).to be_failure
        expect(result.failure).to include(:parent_transfer_id)
      end

      it 'fails when dates is missing' do
        result = operation.validate(params: {
          parent_transfer_id: parent_transfer.id,
          balance_state: balance_state
        })
        expect(result).to be_failure
        expect(result.failure).to include(:dates)
      end

      it 'fails when balance_state is missing' do
        result = operation.validate(params: {
          parent_transfer_id: parent_transfer.id,
          dates: dates
        })
        expect(result).to be_failure
        expect(result.failure).to include(:balance_state)
      end
    end

    context 'with invalid balance_state' do
      it 'fails when balance_state is not a valid transaction balance state' do
        result = operation.validate(params: {
          parent_transfer_id: parent_transfer.id,
          dates: dates,
          balance_state: "invalid_state"
        })
        expect(result).to be_failure
        expect(result.failure).to include(:balance_state)
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation' do
        result = operation.validate(params: {
          parent_transfer_id: parent_transfer.id,
          dates: dates,
          balance_state: balance_state
        })
        expect(result).to be_success
      end
    end
  end

  describe '#call' do
    let(:valid_params) do
      {
        parent_transfer_id: parent_transfer.id,
        dates: dates,
        balance_state: balance_state
      }
    end

    context 'when parent transfer does not exist' do
      it 'returns not found error' do
        result = operation.call({
          parent_transfer_id: "non-existent-id",
          dates: dates,
          balance_state: balance_state
        })
        expect(result).to be_failure
        expect(result.failure).to include(:parent_transfer_id)
      end
    end

    context 'when parent transfer has zero transaction cost' do
      let(:parent_transfer_no_fee) do
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               amount: Money.from_amount(100, "PHP"),
               transaction_cost: Money.from_amount(0, "PHP"),
               date: Time.zone.today)
      end

      it 'returns empty array without creating fee transactions' do
        result = operation.call({
          parent_transfer_id: parent_transfer_no_fee.id,
          dates: dates,
          balance_state: balance_state
        })
        expect(result).to be_success
        expect(result.value!).to eq([])
      end
    end

    context 'with valid parent transfer and transaction cost' do
      let(:fee_category) { create(:category, name: "Transfer Fee", space:, category_type: "expense") }
      let(:created_transfers) do
        dates.map do |date|
          create(:transfer,
                 user:,
                 space:,
                 from_account:,
                 to_account:,
                 amount: Money.from_amount(100, "PHP"),
                 transaction_cost: Money.from_amount(10, "PHP"),
                 date: date,
                 parent_id: parent_transfer.id,
                 repeat_count: 1)
        end
      end
      let(:find_or_create_operation) { instance_double(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory) }
      let(:setup_operation) { instance_double(Transactions::Operations::Transfers::SetupTransferFeeTransaction) }
      let(:calculate_balance_operation) { instance_double(Transactions::Operations::Accounts::CalculateBalance) }

      before do
        # Create the child transfers that would be found by the operation
        created_transfers

        # Stub external operations
        allow(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory).to receive(:new).and_return(find_or_create_operation)
        allow(find_or_create_operation).to receive(:call).and_return(Success(fee_category))

        allow(Transactions::Operations::Transfers::SetupTransferFeeTransaction).to receive(:new).and_return(setup_operation)
        allow(setup_operation).to receive(:call).and_return(Success(instance_double(Transactions::Expense, id: "fee-123")))

        allow(Transactions::Operations::Accounts::CalculateBalance).to receive(:new).and_return(calculate_balance_operation)
        allow(calculate_balance_operation).to receive(:call).and_return(Success())

        # Stub bulk_import
        allow(Transactions::Expense).to receive(:bulk_import).and_return(Success())
      end

      it 'finds or creates transfer fee category' do
        expect(find_or_create_operation).to receive(:call).with(space_id: parent_transfer.space_id).and_return(Success(fee_category)) # rubocop:disable RSpec/StubbedMock

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'finds created transfers within date range' do
        result = operation.call(valid_params)
        expect(result).to be_success

        # Verify that the operation would find the created transfers
        parent_id = parent_transfer.parent_id || parent_transfer.id
        sorted_dates = dates.sort.map { |date| date.to_date.in_time_zone("Asia/Manila") }
        expected_transfers = Transactions::Transfer.where(
          parent_id: parent_id,
          date: sorted_dates.first..sorted_dates.last.end_of_day
        ).order(date: :asc)

        expect(expected_transfers.count).to eq(2)
        expect(expected_transfers.map(&:date)).to match_array(dates)
      end

      it 'creates fee transactions for each transfer' do
        expect(setup_operation).to receive(:call).twice.and_return(Success(instance_double(Transactions::Expense, id: "fee-123")))

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'bulk imports fee transactions' do
        fee_transaction_records = [instance_double(Transactions::Expense, id: "fee-1"), instance_double(Transactions::Expense, id: "fee-2")]
        allow(setup_operation).to receive(:call).and_return(Success(fee_transaction_records[0]), Success(fee_transaction_records[1]))

        expect(Transactions::Expense).to receive(:bulk_import).with( # rubocop:disable RSpec/StubbedMock
          fee_transaction_records,
          validate: true,
          validate_uniqueness: true
        ).and_return(Success())

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      context 'when balance_state is calculated' do
        it 'calculates balances for fee transactions' do
          fee_transaction = instance_double(Transactions::Expense, id: "fee-123")
          allow(setup_operation).to receive(:call).and_return(Success(fee_transaction))

          expect(calculate_balance_operation).to receive(:call).with(transaction_id: "fee-123").and_return(Success()) # rubocop:disable RSpec/StubbedMock

          result = operation.call(valid_params)
          expect(result).to be_success
        end
      end

      context 'when balance_state is pending' do
        let(:balance_state) { "pending" }

        it 'does not calculate balances for fee transactions' do
          expect(calculate_balance_operation).not_to receive(:call)

          result = operation.call(valid_params)
          expect(result).to be_success
        end
      end

      it 'returns the created fee transactions' do
        fee_transaction1 = instance_double(Transactions::Expense, id: "fee-1")
        fee_transaction2 = instance_double(Transactions::Expense, id: "fee-2")
        allow(setup_operation).to receive(:call).and_return(Success(fee_transaction1), Success(fee_transaction2))

        result = operation.call(valid_params)
        expect(result).to be_success
        expect(result.value!).to eq([fee_transaction1, fee_transaction2])
      end
    end

    context 'when find_or_create_transfer_fee_category fails' do
      before do
        find_or_create_operation = instance_double(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory)
        allow(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory).to receive(:new).and_return(find_or_create_operation)
        allow(find_or_create_operation).to receive(:call).and_return(Failure(category: "could not create Transfer Fee category"))
      end

      it 'propagates the failure' do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:category)
      end
    end

    context 'when setup_transfer_fee_transaction fails' do
      before do
        fee_category = create(:category, name: "Transfer Fee", space:, category_type: "expense")
        find_or_create_operation = instance_double(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory)
        allow(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory).to receive(:new).and_return(find_or_create_operation)
        allow(find_or_create_operation).to receive(:call).and_return(Success(fee_category))

        setup_operation = instance_double(Transactions::Operations::Transfers::SetupTransferFeeTransaction)
        allow(Transactions::Operations::Transfers::SetupTransferFeeTransaction).to receive(:new).and_return(setup_operation)
        allow(setup_operation).to receive(:call).and_return(Failure(error: "setup failed"))

        # Create child transfers
        dates.each do |date|
          create(:transfer,
                 user:,
                 space:,
                 from_account:,
                 to_account:,
                 amount: Money.from_amount(100, "PHP"),
                 transaction_cost: Money.from_amount(10, "PHP"),
                 date: date,
                 parent_id: parent_transfer.id,
                 repeat_count: 1)
        end
      end

      it 'propagates the failure' do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end

    context 'when bulk_import fails' do
      before do
        fee_category = create(:category, name: "Transfer Fee", space:, category_type: "expense")
        find_or_create_operation = instance_double(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory)
        allow(Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory).to receive(:new).and_return(find_or_create_operation)
        allow(find_or_create_operation).to receive(:call).and_return(Success(fee_category))

        setup_operation = instance_double(Transactions::Operations::Transfers::SetupTransferFeeTransaction)
        allow(Transactions::Operations::Transfers::SetupTransferFeeTransaction).to receive(:new).and_return(setup_operation)
        allow(setup_operation).to receive(:call).and_return(Success(instance_double(Transactions::Expense, id: "fee-123")))

        allow(Transactions::Expense).to receive(:bulk_import).and_raise(StandardError.new("bulk import failed"))

        # Create child transfers
        dates.each do |date|
          create(:transfer,
                 user:,
                 space:,
                 from_account:,
                 to_account:,
                 amount: Money.from_amount(100, "PHP"),
                 transaction_cost: Money.from_amount(10, "PHP"),
                 date: date,
                 parent_id: parent_transfer.id,
                 repeat_count: 1)
        end
      end

      it 'handles bulk import failure gracefully' do
        expect { operation.call(valid_params) }.to raise_error(StandardError, "bulk import failed")
      end
    end
  end

  describe '#find_parent_transfer' do
    it 'finds the parent transfer successfully' do
      result = operation.send(:find_parent_transfer, params: { parent_transfer_id: parent_transfer.id })
      expect(result).to be_success
      expect(result.value!).to eq(parent_transfer)
    end

    it 'returns failure when transfer is not found' do
      result = operation.send(:find_parent_transfer, params: { parent_transfer_id: "non-existent" })
      expect(result).to be_failure
      expect(result.failure).to include(:parent_transfer_id)
    end
  end

  describe '#find_created_transfers' do
    let(:created_transfers) do
      dates.map do |date|
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               amount: Money.from_amount(100, "PHP"),
               transaction_cost: Money.from_amount(10, "PHP"),
               date: date,
               parent_id: parent_transfer.id,
               repeat_count: 1)
      end
    end

    before do
      created_transfers
    end

    it 'finds transfers within the date range' do
      result = operation.send(:find_created_transfers, params: { dates: dates }, parent_transfer: parent_transfer)
      expect(result).to be_success
      expect(result.value!.count).to eq(2)
      expect(result.value!.map(&:date)).to match_array(dates)
    end

    it 'sorts dates and converts to timezone' do
      unsorted_dates = [dates[1], dates[0]] # Reverse order
      result = operation.send(:find_created_transfers, params: { dates: unsorted_dates }, parent_transfer: parent_transfer)
      expect(result).to be_success
      expect(result.value!.count).to eq(2)
    end

    it 'uses parent_id or id as fallback' do
      parent_transfer_with_parent = create(:transfer, user:, space:, from_account:, to_account:, parent_id: "parent-123")
      result = operation.send(:find_created_transfers, params: { dates: dates }, parent_transfer: parent_transfer_with_parent)
      expect(result).to be_success
    end
  end

  describe '#create_bulk_fee_transactions' do
    let(:fee_category) { create(:category, name: "Transfer Fee", space:, category_type: "expense") }
    let(:created_transfers) do
      dates.map do |date|
        create(:transfer,
               user:,
               space:,
               from_account:,
               to_account:,
               amount: Money.from_amount(100, "PHP"),
               transaction_cost: Money.from_amount(10, "PHP"),
               date: date,
               parent_id: parent_transfer.id,
               repeat_count: 1)
      end
    end
    let(:setup_operation) { instance_double(Transactions::Operations::Transfers::SetupTransferFeeTransaction) }

    before do
      created_transfers
      allow(Transactions::Operations::Transfers::SetupTransferFeeTransaction).to receive(:new).and_return(setup_operation)
      allow(setup_operation).to receive(:call).and_return(Success(instance_double(Transactions::Expense)))
      allow(Transactions::Expense).to receive(:bulk_import).and_return(Success())
    end

    it 'creates fee transaction records for each transfer' do
      expect(setup_operation).to receive(:call).twice.and_return(Success(instance_double(Transactions::Expense)))

      result = operation.send(:create_bulk_fee_transactions,
                              params: { dates: dates, balance_state: balance_state },
                              created_transfers: created_transfers,
                              fee_category: fee_category)
      expect(result).to be_success
    end

    it 'bulk imports the fee transaction records' do
        fee_transaction1 = instance_double(Transactions::Expense, id: "fee-1")
        fee_transaction2 = instance_double(Transactions::Expense, id: "fee-2")
      allow(setup_operation).to receive(:call).and_return(Success(fee_transaction1), Success(fee_transaction2))

      expect(Transactions::Expense).to receive(:bulk_import).with( # rubocop:disable RSpec/StubbedMock
        [fee_transaction1, fee_transaction2],
        validate: true,
        validate_uniqueness: true
      ).and_return(Success())

      result = operation.send(:create_bulk_fee_transactions,
                              params: { dates: dates, balance_state: balance_state },
                              created_transfers: created_transfers,
                              fee_category: fee_category)
      expect(result).to be_success
    end

    it 'returns the created fee transaction records' do
        fee_transaction1 = instance_double(Transactions::Expense, id: "fee-1")
        fee_transaction2 = instance_double(Transactions::Expense, id: "fee-2")
      allow(setup_operation).to receive(:call).and_return(Success(fee_transaction1), Success(fee_transaction2))

      result = operation.send(:create_bulk_fee_transactions,
                              params: { dates: dates, balance_state: balance_state },
                              created_transfers: created_transfers,
                              fee_category: fee_category)
      expect(result).to be_success
      expect(result.value!).to eq([fee_transaction1, fee_transaction2])
    end
  end

  describe '#calculate_balances' do
    let(:fee_transactions) { [instance_double(Transactions::Expense, id: "fee-1"), instance_double(Transactions::Expense, id: "fee-2")] }
    let(:calculate_balance_operation) { instance_double(Transactions::Operations::Accounts::CalculateBalance) }

    before do
      allow(Transactions::Operations::Accounts::CalculateBalance).to receive(:new).and_return(calculate_balance_operation)
      allow(calculate_balance_operation).to receive(:call).and_return(Success())
    end

    context 'when balance_state is calculated' do
      it 'calculates balances for all fee transactions' do
        expect(calculate_balance_operation).to receive(:call).with(transaction_id: "fee-1").and_return(Success()) # rubocop:disable RSpec/StubbedMock
        expect(calculate_balance_operation).to receive(:call).with(transaction_id: "fee-2").and_return(Success()) # rubocop:disable RSpec/StubbedMock

        result = operation.send(:calculate_balances, fee_transactions: fee_transactions, balance_state: "calculated")
        expect(result).to be_success
      end
    end

    context 'when balance_state is pending' do
      it 'does not calculate balances' do
        expect(calculate_balance_operation).not_to receive(:call)

        result = operation.send(:calculate_balances, fee_transactions: fee_transactions, balance_state: "pending")
        expect(result).to be_success
      end
    end

    context 'when balance_state is invalid' do
      it 'does not calculate balances' do
        expect(calculate_balance_operation).not_to receive(:call)

        result = operation.send(:calculate_balances, fee_transactions: fee_transactions, balance_state: "invalid")
        expect(result).to be_success
      end
    end
  end
end
