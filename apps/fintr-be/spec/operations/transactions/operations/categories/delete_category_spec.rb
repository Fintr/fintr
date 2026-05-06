# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Categories::DeleteCategory do
  let(:operation) { described_class.new }
  let!(:user) { create(:user) }
  let!(:space) { create(:space) }
  let!(:category_to_delete) { create(:category, space: space, name: "Category to Delete") }
  let!(:category_with_transactions) { create(:category, space: space, name: "Category With Transactions") }

  # Create a transaction associated with category_with_transactions
  let!(:transaction) { create(:transaction, space: space, category: category_with_transactions) }

  describe '#call' do
    context 'when the deletion is successful (no associated transactions)' do
      subject(:call_operation) { operation.call(valid_params) }

      let(:valid_params) do
        {
          id: category_to_delete.id,
          space_id: space.id
        }
      end

      before do
        allow(Transactions::Category).to receive(:find_by).and_call_original
        allow(Transactions::Category).to receive(:find_by).with(id: category_to_delete.id, space_id: space.id).and_return(category_to_delete)
      end

      it { is_expected.to be_success }

      it 'deletes the category' do
        expect { call_operation }.to change(Transactions::Category, :count).by(-1)
      end

      it 'returns the deleted category object' do
        result = call_operation.value!
        expect(result).to eq(category_to_delete)
      end
    end

    context 'when the category has associated transactions' do
      subject(:call_operation) { operation.call(params_with_transactions) }

      let(:params_with_transactions) do
        {
          id: category_with_transactions.id,
          space_id: space.id
        }
      end

      before do
        allow(Transactions::Category).to receive(:find_by).and_call_original
        allow(Transactions::Category).to receive(:find_by).with(id: category_with_transactions.id, space_id: space.id).and_return(category_with_transactions)
        # No need to stub `transactions` directly as it's an ActiveRecord association
        allow(category_with_transactions).to receive(:destroy)
      end

      it { is_expected.to be_failure }

      it 'does not delete the category' do
        # Expect category count not to change, but specifically test the failure condition
        expect { call_operation }.not_to change(Transactions::Category, :count)
      end

      it 'returns a failure with a cannot delete message' do
        expect(call_operation.failure).to eq(category: "Cannot delete category. There are transactions associated with the category.")
      end
    end

    context 'with validation errors' do
      context 'when id is missing' do
        subject(:call_operation) { operation.call(params_missing_id) }

        let(:params_missing_id) { { space_id: space.id } }

        it { is_expected.to be_failure }

        it 'returns a failure with id missing error' do
          expect(call_operation.failure).to eq({ id: ['is missing'] })
        end
      end

      context 'when space_id is missing' do
        subject(:call_operation) { operation.call(params_missing_space_id) }

        let(:params_missing_space_id) { { id: category_to_delete.id } }

        it { is_expected.to be_failure }

        it 'returns a failure with space_id missing error' do
          expect(call_operation.failure).to eq({ space_id: ['is missing'] })
        end
      end
    end

    context 'when the category is not found' do
      subject(:call_operation) { operation.call(params_with_non_existent_id) }

      let(:params_with_non_existent_id) do
        {
          id: "non-existent-id",
          space_id: space.id
        }
      end

      before do
        allow(Transactions::Category).to receive(:find_by).and_return(nil)
      end

      it { is_expected.to be_failure }

      it 'returns a failure with category not found error' do
        expect(call_operation.failure).to eq(category: "Not found")
      end
    end

    context 'when the category does not belong to the correct space' do
      subject(:call_operation) { operation.call(params_for_wrong_space) }

      let!(:other_space) { create(:space) }
      let!(:category_in_other_space) { create(:category, space: other_space, name: "Other Category") }

      let(:params_for_wrong_space) do
        {
          id: category_in_other_space.id,
          space_id: space.id # Current space_id, but category is in other_space
        }
      end

      before do
        allow(Transactions::Category).to receive(:find_by).with(id: category_in_other_space.id, space_id: space.id).and_return(nil)
      end

      it { is_expected.to be_failure }

      it 'returns a failure with category not found error' do
        expect(call_operation.failure).to eq(category: "Not found")
      end
    end
  end
end
