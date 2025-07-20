# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Accounts::DeleteAccount do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:account_without_transactions) { create(:account, space: space, name: "Empty Account") }
  let!(:account_with_transactions) { create(:account, space: space, name: "Account With Transactions") }
  let!(:transaction) { create(:transaction, account: account_with_transactions, space: space) }

  describe '#call' do
    context 'when deletion is successful (account has no transactions)' do
      let(:valid_params) do
        {
          space_id: space.id.to_s,
          id: account_without_transactions.id.to_s
        }
      end

      it 'discards the account successfully' do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(account_without_transactions.reload).to be_discarded
      end

      it 'returns the discarded account object' do
        result = operation.call(valid_params)

        expect(result.value!.id).to eq(account_without_transactions.id)
        expect(result.value!.name).to eq(account_without_transactions.name)
        expect(result.value!).to be_discarded
      end

      it 'does not physically remove the account from the database' do
        expect { operation.call(valid_params) }
          .not_to change(Transactions::Account, :count)
      end
    end

    context 'when account has transactions' do
      let(:params_with_transactions) do
        {
          space_id: space.id.to_s,
          id: account_with_transactions.id.to_s
        }
      end

      it 'discards the account successfully' do
        result = operation.call(params_with_transactions)

        expect(result).to be_success
        expect(account_with_transactions.reload).to be_discarded
      end

      it 'does not physically remove the account from the database' do
        expect { operation.call(params_with_transactions) }
          .not_to change(Transactions::Account, :count)
      end

      it 'does not discard associated transactions' do
        operation.call(params_with_transactions)
        expect(Transactions::Transaction.exists?(transaction.id)).to be true
      end
    end

    context 'when account is not found (already discarded or non-existent)' do
      let(:params_with_invalid_id) do
        {
          space_id: space.id.to_s,
          id: "invalid-id"
        }
      end

      before do
        account_without_transactions.discard! # Discard it before the test
      end

      it 'fails with account not found error' do
        result = operation.call(params_with_invalid_id)

        expect(result).to be_failure
        expect(result.failure).to eq(account: "not found")
      end
    end

    context 'when account belongs to different space' do
      let(:other_space) { create(:personal_space) }
      let(:params_with_wrong_space) do
        {
          space_id: other_space.id.to_s,
          id: account_without_transactions.id.to_s
        }
      end

      it 'fails with account not found error' do
        result = operation.call(params_with_wrong_space)

        expect(result).to be_failure
        expect(result.failure).to eq(account: "not found")
      end
    end

    context 'with invalid parameters' do
      context 'when space_id is missing' do
        let(:params_without_space_id) do
          {
            id: account_without_transactions.id.to_s
          }
        end

        it 'fails validation' do
          result = operation.call(params_without_space_id)

          expect(result).to be_failure
          expect(result.failure).to have_key(:space_id)
        end
      end

      context 'when id is missing' do
        let(:params_without_id) do
          {
            space_id: space.id.to_s
          }
        end

        it 'fails validation' do
          result = operation.call(params_without_id)

          expect(result).to be_failure
          expect(result.failure).to have_key(:id)
        end
      end

      context 'when space_id is not a string' do
        let(:params_with_invalid_space_id) do
          {
            space_id: 123,
            id: account_without_transactions.id.to_s
          }
        end

        it 'fails validation' do
          result = operation.call(params_with_invalid_space_id)

          expect(result).to be_failure
          expect(result.failure).to have_key(:space_id)
        end
      end

      context 'when id is not a string' do
        let(:params_with_invalid_id) do
          {
            space_id: space.id.to_s,
            id: 123
          }
        end

        it 'fails validation' do
          result = operation.call(params_with_invalid_id)

          expect(result).to be_failure
          expect(result.failure).to have_key(:id)
        end
      end
    end
  end

  describe 'private methods' do
    describe '#find_account' do
      it 'finds account by id and space_id' do
        params = { id: account_without_transactions.id.to_s, space_id: space.id.to_s }
        result = operation.send(:find_account, params: params)

        expect(result).to be_success
        expect(result.value!).to eq(account_without_transactions)
      end

      it 'fails when account is not found' do
        params = { id: "invalid-id", space_id: space.id.to_s }
        result = operation.send(:find_account, params: params)

        expect(result).to be_failure
        expect(result.failure).to eq(account: "not found")
      end

      it 'can find discarded accounts' do
        account_without_transactions.discard! # Discard it
        params = { id: account_without_transactions.id.to_s, space_id: space.id.to_s }
        result = operation.send(:find_account, params: params)

        expect(result).to be_success
        expect(result.value!).to eq(account_without_transactions)
      end
    end

    describe '#delete_account' do
      it 'discards the account and returns success' do
        # Create a separate account for this test to avoid affecting other tests
        test_account = create(:account, space: space, name: "Test Account")

        result = operation.send(:delete_account, account: test_account)

        expect(result).to be_success
        expect(test_account.reload).to be_discarded
      end

      it 'returns the discarded account object' do
        test_account = create(:account, space: space, name: "Test Account")
        result = operation.send(:delete_account, account: test_account)

        expect(result).to be_success
        expect(result.value!).to eq(test_account)
      end

      it 'does not physically remove the account from the database' do
        test_account = create(:account, space: space, name: "Test Account")

        expect { operation.send(:delete_account, account: test_account) }
          .not_to change(Transactions::Account, :count)
      end
    end
  end
end
