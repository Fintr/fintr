# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Categories::UpdateCategory do
  let(:operation) { described_class.new }
  let!(:user) { create(:user) }
  let!(:space) { create(:space) }
  let!(:category) { create(:category, space: space, name: "Old Category Name") }

  describe '#call' do
    context 'when the update is successful' do
      subject(:call_operation) { operation.call(valid_params) }

      let(:valid_params) do
        {
          id: category.id,
          space_id: space.id,
          name: "New Category Name"
        }
      end

      before do
        allow(Transactions::Category).to receive(:find_by).with(id: category.id, space_id: space.id).and_return(category)
        allow(category).to receive(:update).and_return(true)
      end

      it { is_expected.to be_success }

      it 'calls update on the category with the new attributes' do
        expect(category).to receive(:update).with(
          hash_including(name: "New Category Name"),
        )
        call_operation
      end

      it 'returns the updated category object' do
        result = call_operation.value!
        expect(result).to eq(category)
      end
    end

    context 'with validation errors' do
      context 'when id is missing' do
        subject(:call_operation) { operation.call(params_missing_id) }

        let(:params_missing_id) { { space_id: space.id, name: "New Category Name" } }

        it { is_expected.to be_failure }

        it 'returns a failure with id missing error' do
          expect(call_operation.failure).to eq({ id: ['is missing'] })
        end
      end

      context 'when space_id is missing' do
        subject(:call_operation) { operation.call(params_missing_space_id) }

        let(:params_missing_space_id) { { id: category.id, name: "New Category Name" } }

        it { is_expected.to be_failure }

        it 'returns a failure with space_id missing error' do
          expect(call_operation.failure).to eq({ space_id: ['is missing'] })
        end
      end

      context 'when name is missing' do
        subject(:call_operation) { operation.call(params_missing_name) }

        let(:params_missing_name) { { id: category.id, space_id: space.id } }

        it { is_expected.to be_failure }

        it 'returns a failure with name missing error' do
          expect(call_operation.failure).to eq({ name: ['is missing'] })
        end
      end

      context 'when name is not a string' do
        subject(:call_operation) { operation.call(params_invalid_name) }

        let(:params_invalid_name) { { id: category.id, space_id: space.id, name: 123 } }

        it { is_expected.to be_failure }

        it 'returns a failure with name type error' do
          expect(call_operation.failure).to eq({ name: ['must be a string'] })
        end
      end
    end

    context 'when the category is not found' do
      subject(:call_operation) { operation.call(params_with_non_existent_id) }

      let(:params_with_non_existent_id) do
        {
          id: "non-existent-id",
          space_id: space.id,
          name: "New Category Name"
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
          space_id: space.id, # Current space_id, but category is in other_space
          name: "New Category Name"
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

    context 'when category.update fails (e.g. model validation error)' do
      subject(:call_operation) { operation.call(valid_params_for_save_fail) }

      let(:valid_params_for_save_fail) do
        {
          id: category.id,
          space_id: space.id,
          name: "Invalid Name"
        }
      end
      let(:mock_category_errors) { { name: ['cannot be invalid'] } }

      before do
        allow(Transactions::Category).to receive(:find_by).with(id: category.id, space_id: space.id).and_return(category)
        allow(category).to receive(:update).and_raise(ActiveRecord::RecordInvalid.new(category))
        allow(category).to receive(:errors).and_return(instance_double(ActiveModel::Errors, to_hash: mock_category_errors))
      end

      it { is_expected.to be_failure }

      it 'returns a failure with category errors' do
        expected_failure = mock_category_errors.merge(error: kind_of(ActiveRecord::RecordInvalid))
        expect(call_operation.failure).to include(expected_failure)
      end
    end
  end
end
