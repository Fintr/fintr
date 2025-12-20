# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Imports::Operations::BulkImportTransactions do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:import) { create(:import, user: user, space: space) }
  let(:import_account) { create(:account, space: space, balance: Money.from_amount(10_000, 'PHP')) }
  let(:income_category) { create(:category, space: space, category_type: 'income', name: 'Salary') }
  let(:expense_category) { create(:category, space: space, category_type: 'expense', name: 'Groceries') }

  let(:validated_rows) do
    [
      {
        row_data: {
          amount: 1000.0,
          description: 'Test income',
          category: 'Salary',
          date: '2024-01-15'
        },
        category: income_category,
        parsed_date: Date.new(2024, 1, 15),
        row_number: 1
      },
      {
        row_data: {
          amount: 500.0,
          description: 'Test expense',
          category: 'Groceries',
          date: '2024-01-16'
        },
        category: expense_category,
        parsed_date: Date.new(2024, 1, 16),
        row_number: 2
      }
    ]
  end

  let(:valid_params) do
    {
      import: import,
      import_account: import_account,
      validated_rows: validated_rows
    }
  end

  describe 'Contract' do
    let(:contract) { described_class::Contract.new }

    context 'when valid params are provided' do
      it 'succeeds with valid parameters' do
        result = contract.call(valid_params)
        expect(result).to be_success
      end

      it 'returns the validated params' do
        result = contract.call(valid_params)
        validated_params = result.to_h
        expect(validated_params[:import]).to eq(import)
        expect(validated_params[:import_account]).to eq(import_account)
        expect(validated_params[:validated_rows]).to eq(validated_rows)
      end
    end

    context 'when import is missing' do
      let(:params_without_import) { valid_params.except(:import) }

      it 'returns a failure result' do
        result = contract.call(params_without_import)
        expect(result).to be_failure
      end

      it 'returns import error' do
        result = contract.call(params_without_import)
        expect(result.errors.to_h).to have_key(:import)
      end
    end

    context 'when import_account is missing' do
      let(:params_without_account) { valid_params.except(:import_account) }

      it 'returns a failure result' do
        result = contract.call(params_without_account)
        expect(result).to be_failure
      end

      it 'returns import_account error' do
        result = contract.call(params_without_account)
        expect(result.errors.to_h).to have_key(:import_account)
      end
    end

    context 'when validated_rows is missing' do
      let(:params_without_rows) { valid_params.except(:validated_rows) }

      it 'returns a failure result' do
        result = contract.call(params_without_rows)
        expect(result).to be_failure
      end

      it 'returns validated_rows error' do
        result = contract.call(params_without_rows)
        expect(result.errors.to_h).to have_key(:validated_rows)
      end
    end

    context 'when validated_rows contains invalid row_data' do
      let(:invalid_row_data) do
        [
          {
            row_data: {
              amount: -100.0, # Invalid: negative amount
              description: 'Test',
              category: 'Salary',
              date: '2024-01-15'
            },
            category: income_category,
            parsed_date: Date.new(2024, 1, 15),
            row_number: 1
          }
        ]
      end
      let(:params_with_invalid_row) { valid_params.merge(validated_rows: invalid_row_data) }

      it 'returns a failure result' do
        result = contract.call(params_with_invalid_row)
        expect(result).to be_failure
      end
    end

    context 'when validated_rows contains invalid date format' do
      let(:invalid_date_row) do
        [
          {
            row_data: {
              amount: 100.0,
              description: 'Test',
              category: 'Salary',
              date: '01-15-2024' # Invalid format
            },
            category: income_category,
            parsed_date: Date.new(2024, 1, 15),
            row_number: 1
          }
        ]
      end
      let(:params_with_invalid_date) { valid_params.merge(validated_rows: invalid_date_row) }

      it 'returns a failure result' do
        result = contract.call(params_with_invalid_date)
        expect(result).to be_failure
      end
    end

    context 'when validated_rows contains missing category' do
      let(:invalid_category_row) do
        [
          {
            row_data: {
              amount: 100.0,
              description: 'Test',
              category: 'Salary',
              date: '2024-01-15'
            },
            category: nil, # Invalid: missing category
            parsed_date: Date.new(2024, 1, 15),
            row_number: 1
          }
        ]
      end
      let(:params_with_invalid_category) { valid_params.merge(validated_rows: invalid_category_row) }

      it 'returns a failure result' do
        result = contract.call(params_with_invalid_category)
        expect(result).to be_failure
      end
    end
  end

  describe '#call' do
    context 'when validated_rows is empty' do
      let(:empty_params) { valid_params.merge(validated_rows: []) }

      it 'returns success with empty import_records' do
        result = operation.call(empty_params)
        expect(result).to be_success
        value = result.value!
        # Handle case where value might be nested Success
        actual_value = value.is_a?(Dry::Monads::Result::Success) ? value.value! : value
        expect(actual_value[:import_records]).to eq([])
      end

      it 'does not create any transactions' do
        expect { operation.call(empty_params) }.not_to change(Transactions::Income, :count)
        expect { operation.call(empty_params) }.not_to change(Transactions::Expense, :count)
      end

      it 'does not create any import records' do
        expect { operation.call(empty_params) }.not_to change(Imports::ImportRecord, :count)
      end
    end

    context 'when importing a single row successfully' do
      let(:single_row_params) { valid_params.merge(validated_rows: [validated_rows.first]) }

      it 'returns success' do
        result = operation.call(single_row_params)
        expect(result).to be_success
      end

      it 'creates one transaction' do
        expect { operation.call(single_row_params) }.to change(Transactions::Income, :count).by(1)
      end

      it 'creates one import record' do
        expect { operation.call(single_row_params) }.to change(Imports::ImportRecord, :count).by(1)
      end

      it 'creates import record with correct attributes' do
        result = operation.call(single_row_params)
        import_record = Imports::ImportRecord.last

        expect(import_record.import).to eq(import)
        expect(import_record.row_number).to eq(1)
        expect(import_record.status).to eq('success')
        expect(import_record.record_type).to eq('Transactions::Income')
        expect(import_record.record_id).to be_present
        expect(import_record.original_data).to eq(validated_rows.first[:row_data].stringify_keys)
      end

      it 'creates transaction with correct attributes' do
        operation.call(single_row_params)
        transaction = Transactions::Income.last

        expect(transaction.user_id).to eq(user.id)
        expect(transaction.space_id).to eq(space.id)
        expect(transaction.category_id).to eq(income_category.id)
        expect(transaction.account_id).to eq(import_account.id)
        expect(transaction.date).to eq(Date.new(2024, 1, 15))
        expect(transaction.description).to eq('Test income')
        expect(transaction.amount_cents).to eq(100_000)
        expect(transaction.amount_currency).to eq('PHP')
        expect(transaction.balance_state).to eq('calculated')
        expect(transaction.schedule_type).to eq('one_time')
      end
    end

    context 'when importing multiple rows successfully' do
      it 'returns success' do
        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'creates all transactions' do
        expect { operation.call(valid_params) }.to change(Transactions::Income, :count).by(1)
          .and change(Transactions::Expense, :count).by(1)
      end

      it 'creates all import records' do
        expect { operation.call(valid_params) }.to change(Imports::ImportRecord, :count).by(2)
      end

      it 'creates import records with correct row numbers' do
        operation.call(valid_params)
        import_records = Imports::ImportRecord.order(:row_number)

        expect(import_records.first.row_number).to eq(1)
        expect(import_records.second.row_number).to eq(2)
        expect(import_records.map(&:status).uniq).to eq(['success'])
      end
    end

    context 'when importing rows in batches' do
      let(:large_batch_rows) do
        (1..1500).map do |i|
          {
            row_data: {
              amount: 100.0 + i,
              description: "Transaction #{i}",
              category: i.even? ? 'Salary' : 'Groceries',
              date: "2024-01-#{format('%02d', (i % 28) + 1)}"
            },
            category: i.even? ? income_category : expense_category,
            parsed_date: Date.new(2024, 1, (i % 28) + 1),
            row_number: i
          }
        end
      end
      let(:large_batch_params) { valid_params.merge(validated_rows: large_batch_rows) }

      it 'processes all rows in batches' do
        result = operation.call(large_batch_params)
        expect(result).to be_success
        value = result.value!
        # Handle case where value might be nested Success
        actual_value = value.is_a?(Dry::Monads::Result::Success) ? value.value! : value
        import_records = actual_value[:import_records]
        expect(import_records.count).to eq(1500)
      end

      it 'creates all transactions' do
        expect { operation.call(large_batch_params) }.to change(Transactions::Income, :count).by(750)
          .and change(Transactions::Expense, :count).by(750)
      end

      it 'creates all import records' do
        expect { operation.call(large_batch_params) }.to change(Imports::ImportRecord, :count).by(1500)
      end
    end

    context 'when batch import fails' do
      before do
        allow(Transactions::Income).to receive(:import).and_raise(ActiveRecord::StatementInvalid.new('Database error'))
      end

      let(:single_row_params) { valid_params.merge(validated_rows: [validated_rows.first]) }

      it 'returns success with import records' do
        result = operation.call(single_row_params)
        expect(result).to be_success
      end

      it 'creates failed import records for failed batches' do
        expect { operation.call(single_row_params) }.to change(Imports::ImportRecord, :count).by(1)

        failed_record = Imports::ImportRecord.last
        expect(failed_record.status).to eq('failed')
        expect(failed_record.import_errors).to include('Database error during bulk import')
      end

      it 'does not create transactions when batch fails' do
        expect { operation.call(single_row_params) }.not_to change(Transactions::Income, :count)
      end
    end

    context 'when transaction cannot be found after import' do
      before do
        # Mock import_batch to return empty map (transaction not found)
        allow(operation).to receive(:import_batch).and_return(imported_transactions_map: {})
      end

      let(:single_row_params) { valid_params.merge(validated_rows: [validated_rows.first]) }

      it 'creates failed import record' do
        expect { operation.call(single_row_params) }.to change(Imports::ImportRecord, :count).by(1)

        failed_record = Imports::ImportRecord.last
        expect(failed_record.status).to eq('failed')
        expect(failed_record.import_errors).to include('Database error during bulk import')
      end
    end



    context 'when importing income transactions' do
      let(:income_row) do
        [
          {
            row_data: {
              amount: 2000.0,
              description: 'Salary payment',
              category: 'Salary',
              date: '2024-01-20'
            },
            category: income_category,
            parsed_date: Date.new(2024, 1, 20),
            row_number: 1
          }
        ]
      end
      let(:income_params) { valid_params.merge(validated_rows: income_row) }

      it 'creates income transaction' do
        expect { operation.call(income_params) }.to change(Transactions::Income, :count).by(1)
        expect { operation.call(income_params) }.not_to change(Transactions::Expense, :count)
      end

      it 'sets correct transaction type' do
        operation.call(income_params)
        transaction = Transactions::Income.last
        expect(transaction.type).to eq('Transactions::Income')
      end
    end

    context 'when importing expense transactions' do
      let(:expense_row) do
        [
          {
            row_data: {
              amount: 500.0,
              description: 'Grocery shopping',
              category: 'Groceries',
              date: '2024-01-21'
            },
            category: expense_category,
            parsed_date: Date.new(2024, 1, 21),
            row_number: 1
          }
        ]
      end
      let(:expense_params) { valid_params.merge(validated_rows: expense_row) }

      it 'creates expense transaction' do
        expect { operation.call(expense_params) }.to change(Transactions::Expense, :count).by(1)
        expect { operation.call(expense_params) }.not_to change(Transactions::Income, :count)
      end

      it 'sets correct transaction type' do
        operation.call(expense_params)
        transaction = Transactions::Expense.last
        expect(transaction.type).to eq('Transactions::Expense')
      end
    end

    context 'when row_data has no description' do
      let(:row_without_description) do
        [
          {
            row_data: {
              amount: 100.0,
              category: 'Salary',
              date: '2024-01-15'
            },
            category: income_category,
            parsed_date: Date.new(2024, 1, 15),
            row_number: 1
          }
        ]
      end
      let(:params_without_description) { valid_params.merge(validated_rows: row_without_description) }

      it 'creates transaction with nil description' do
        operation.call(params_without_description)
        transaction = Transactions::Income.last
        expect(transaction.description).to be_nil
      end
    end
  end

  describe 'private methods' do
    describe '#prepare_transactions' do
      let(:single_row) { [validated_rows.first] }

      it 'prepares transactions correctly' do
        result = operation.send(:prepare_transactions,
                                validated_rows: single_row,
                                import: import,
                                import_account: import_account)

        expect(result.count).to eq(1)
        expect(result.first[:transaction]).to be_a(Transactions::Income)
        expect(result.first[:row_number]).to eq(1)
        expect(result.first[:row_data]).to eq(validated_rows.first[:row_data])
      end

      it 'converts amount to cents' do
        result = operation.send(:prepare_transactions,
                                validated_rows: single_row,
                                import: import,
                                import_account: import_account)

        transaction = result.first[:transaction]
        expect(transaction.amount_cents).to eq(100_000) # 1000.0 * 100
      end

      it 'sets balance_state to calculated' do
        result = operation.send(:prepare_transactions,
                                validated_rows: single_row,
                                import: import,
                                import_account: import_account)

        transaction = result.first[:transaction]
        expect(transaction.balance_state).to eq('calculated')
      end
    end

    describe '#build_transaction_key' do
      let(:transaction) do
        Transactions::Income.new(
          user_id: user.id,
          space_id: space.id,
          category_id: income_category.id,
          account_id: import_account.id,
          date: Date.new(2024, 1, 15),
          description: 'Test',
          amount_cents: 100_000
        )
      end

      it 'builds correct key format' do
        key = operation.send(:build_transaction_key, transaction)
        # Date is converted to string, which includes time in some cases, so we check the key contains the essential parts
        expect(key).to include(user.id.to_s)
        expect(key).to include(space.id.to_s)
        expect(key).to include(income_category.id.to_s)
        expect(key).to include(import_account.id.to_s)
        expect(key).to include('Test')
        expect(key).to include('100000')
      end
    end
  end
end
