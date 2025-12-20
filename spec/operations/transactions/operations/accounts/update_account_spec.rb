# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Accounts::UpdateAccount do
  let(:operation) { described_class.new }
  let!(:user) { create(:user) }
  let!(:space) { create(:space) }
  let!(:account) { create(:account, space: space, name: "Old Account Name") }

  describe '#call' do
    context 'when the update is successful' do
      subject(:call_operation) { operation.call(valid_params) }

      let(:valid_params) do
        {
          id: account.id,
          space_id: space.id,
          name: "New Account Name"
        }
      end

      before do
        allow(Transactions::Account).to receive(:find).with(account.id).and_return(account)
        allow(account).to receive(:update!).with(name: "New Account Name").and_return(true)
      end

      it { is_expected.to be_success }

      it 'calls update! on the account with the new name' do
        expect(account).to receive(:update!).with(name: "New Account Name")
        call_operation
      end

      it 'returns the updated account object' do
        result = call_operation.value!
        expect(result).to eq(account)
      end
    end

    context 'with validation errors' do
      context 'when space_id is missing' do
        subject(:call_operation) { operation.call(params_missing_space_id) }

        let(:params_missing_space_id) { { id: account.id, name: "New Account Name" } }

        it { is_expected.to be_failure }

        it 'returns a failure with space_id missing error' do
          expect(call_operation.failure).to eq({ space_id: ['is missing'] })
        end
      end

      context 'when id is missing' do
        subject(:call_operation) { operation.call(params_missing_id) }

        let(:params_missing_id) { { space_id: space.id, name: "New Account Name" } }

        it { is_expected.to be_failure }

        it 'returns a failure with id missing error' do
          expect(call_operation.failure).to eq({ id: ['is missing'] })
        end
      end

      context 'when name is missing' do
        subject(:call_operation) { operation.call(params_missing_name) }

        let(:params_missing_name) { { id: account.id, space_id: space.id } }

        it { is_expected.to be_failure }

        it 'returns a failure with name missing error' do
          expect(call_operation.failure).to eq({ name: ['is missing'] })
        end
      end

      context 'when name is not a string' do
        subject(:call_operation) { operation.call(params_invalid_name) }

        let(:params_invalid_name) { { id: account.id, space_id: space.id, name: 123 } }

        it { is_expected.to be_failure }

        it 'returns a failure with name type error' do
          expect(call_operation.failure).to eq({ name: ['must be a string'] })
        end
      end
    end

    context 'when the account is not found' do
      subject(:call_operation) { operation.call(params_with_non_existent_id) }

      let(:params_with_non_existent_id) do
        {
          id: "non-existent-id",
          space_id: space.id,
          name: "New Account Name"
        }
      end

      # NOTE: This test doesn't need a before block for `allow(Transactions::Account).to receive(:find).and_return(nil)`
      # because `Transactions::Account.find` will raise `ActiveRecord::RecordNotFound` by default if the record is not found.
      # The operation's `find_account` method rescues this and returns a Failure.

      it { is_expected.to be_failure }

      it 'returns a failure with account not found error' do
        expect(call_operation.failure).to eq(account: "not found")
      end
    end

    context 'when account.update! fails (e.g. model validation error)' do
      subject(:call_operation) { operation.call(valid_params_for_save_fail) }

      let(:valid_params_for_save_fail) do
        {
          id: account.id,
          space_id: space.id,
          name: "Invalid Name"
        }
      end
      let(:mock_account_errors) { { name: ['cannot be invalid'] } }

      before do
        allow(Transactions::Account).to receive(:find).with(account.id).and_return(account)
        allow(account).to receive(:update!).and_raise(ActiveRecord::RecordInvalid.new(account))
        allow(account).to receive(:errors).and_return(instance_double(ActiveModel::Errors, to_hash: mock_account_errors))
      end

      it { is_expected.to be_failure }

      it 'returns a failure with account errors' do
        expect(call_operation.failure.except(:error, :expected)).to eq(mock_account_errors)
      end
    end
  end
end
