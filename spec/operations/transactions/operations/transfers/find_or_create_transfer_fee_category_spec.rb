# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Transfers::FindOrCreateTransferFeeCategory do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }

  describe '#validate' do
    context 'with missing required parameters' do
      it 'fails when space_id is missing' do
        result = operation.validate(params: { space_id: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
        expect(result.failure[:error]).to include(:space_id)
      end
    end

    context 'with invalid space_id' do
      it 'fails when space_id is not a string' do
        result = operation.validate(params: { space_id: 123 })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
        expect(result.failure[:error]).to include(:space_id)
      end

      it 'fails when space_id is nil' do
        result = operation.validate(params: { space_id: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
        expect(result.failure[:error]).to include(:space_id)
      end
    end

    context 'with valid parameters' do
      it 'succeeds validation' do
        result = operation.validate(params: { space_id: space.id })
        expect(result).to be_success
        expect(result.value!).to eq({ space_id: space.id })
      end
    end
  end

  describe '#call' do
    let(:valid_params) { { space_id: space.id } }

    context 'when Transfer Fee category does not exist' do
      it 'creates a new Transfer Fee category' do
        expect { operation.call(valid_params) }.to change(Transactions::Category, :count).by(1)

        result = operation.call(valid_params)
        expect(result).to be_success

        category = result.value!
        expect(category).to be_a(Transactions::Category)
        expect(category.name).to eq("Transfer Fee")
        expect(category.space_id).to eq(space.id)
        expect(category.category_type).to eq("expense")
      end

      it 'returns the created category' do
        result = operation.call(valid_params)
        expect(result).to be_success

        category = result.value!
        expect(category.name).to eq("Transfer Fee")
        expect(category.space_id).to eq(space.id)
        expect(category.category_type).to eq("expense")
      end
    end

    context 'when Transfer Fee category already exists' do
      let!(:existing_category) do
        create(:category,
               name: "Transfer Fee",
               space:,
               category_type: "expense")
      end

      it 'does not create a new category' do
        expect { operation.call(valid_params) }.not_to change(Transactions::Category, :count)

        result = operation.call(valid_params)
        expect(result).to be_success
      end

      it 'returns the existing category' do
        result = operation.call(valid_params)
        expect(result).to be_success

        category = result.value!
        expect(category).to eq(existing_category)
        expect(category.name).to eq("Transfer Fee")
        expect(category.space_id).to eq(space.id)
        expect(category.category_type).to eq("expense")
      end
    end

    context 'when category creation fails' do
      before do
        allow(Transactions::Category).to receive(:find_or_create_by!).and_raise(
          ActiveRecord::RecordInvalid.new(create(:category))
        )
      end

      it 'handles creation failure gracefully' do
        result = operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:category)
        expect(result.failure[:category]).to eq("could not create Transfer Fee category")
        expect(result.failure).to include(:error)
      end
    end

    context 'with invalid parameters' do
      it 'fails validation and does not attempt to create category' do
        expect(Transactions::Category).not_to receive(:find_or_create_by!)

        result = operation.call({ space_id: nil })
        expect(result).to be_failure
        expect(result.failure).to include(:error)
      end
    end
  end

  describe '#find_or_create_category' do
    let(:valid_params) { { space_id: space.id } }

    context 'when category does not exist' do
      it 'creates a new Transfer Fee category with correct attributes' do
        result = operation.send(:find_or_create_category, params: valid_params)
        expect(result).to be_success

        category = result.value!
        expect(category).to be_a(Transactions::Category)
        expect(category.name).to eq("Transfer Fee")
        expect(category.space_id).to eq(space.id)
        expect(category.category_type).to eq("expense")
      end

      it 'uses find_or_create_by! with correct parameters' do
        allow(Transactions::Category).to receive(:find_or_create_by!).with(
          name: "Transfer Fee",
          space_id: space.id,
          category_type: "expense"
        ).and_return(create(:category, name: "Transfer Fee", space:, category_type: "expense"))

        result = operation.send(:find_or_create_category, params: valid_params)
        expect(result).to be_success
      end
    end

    context 'when category already exists' do
      let!(:existing_category) do
        create(:category,
               name: "Transfer Fee",
               space:,
               category_type: "expense")
      end

      it 'returns the existing category' do
        result = operation.send(:find_or_create_category, params: valid_params)
        expect(result).to be_success

        category = result.value!
        expect(category).to eq(existing_category)
      end
    end

    context 'when ActiveRecord::RecordInvalid is raised' do
      let(:invalid_category) { create(:category) }

      before do
        allow(Transactions::Category).to receive(:find_or_create_by!).and_raise(
          ActiveRecord::RecordInvalid.new(invalid_category)
        )
      end

      it 'returns failure with appropriate error message' do
        result = operation.send(:find_or_create_category, params: valid_params)
        expect(result).to be_failure
        expect(result.failure).to include(:category)
        expect(result.failure[:category]).to eq("could not create Transfer Fee category")
        expect(result.failure).to include(:error)
        expect(result.failure[:error]).to be_a(ActiveRecord::RecordInvalid)
      end
    end

    context 'when other exceptions are raised' do
      before do
        allow(Transactions::Category).to receive(:find_or_create_by!).and_raise(StandardError.new("Database error"))
      end

      it 'lets the exception propagate' do
        expect do
          operation.send(:find_or_create_category, params: valid_params)
        end.to raise_error(StandardError, "Database error")
      end
    end
  end

  describe 'Contract Validations' do
    let(:base_valid_params) { { space_id: space.id } }

    it 'fails if space_id is not a string' do
      params = { space_id: 123 }
      result = operation.call(params)
      expect(result).to be_failure
      expect(result.failure).to include(:error)
      expect(result.failure[:error]).to include(:space_id)
    end

    it 'succeeds if space_id is a valid string' do
      params = { space_id: space.id }
      result = operation.call(params)
      expect(result).to be_success
    end
  end

  describe 'Integration Tests' do
    let(:valid_params) { { space_id: space.id } }

    context 'with multiple spaces' do
      let(:another_space) { create(:personal_space) }
      let(:another_space_params) { { space_id: another_space.id } }

      it 'creates separate Transfer Fee categories for different spaces' do
        result1 = operation.call(valid_params)
        result2 = operation.call(another_space_params)

        expect(result1).to be_success
        expect(result2).to be_success

        category1 = result1.value!
        category2 = result2.value!

        expect(category1.space_id).to eq(space.id)
        expect(category2.space_id).to eq(another_space.id)
        expect(category1).not_to eq(category2)
      end
    end

    context 'with concurrent access' do
      it 'handles concurrent creation attempts gracefully' do
        # Simulate concurrent access by creating the category before the operation runs
        existing_category = create(:category,
                                  name: "Transfer Fee",
                                  space:,
                                  category_type: "expense")

        result = operation.call(valid_params)
        expect(result).to be_success

        category = result.value!
        expect(category).to eq(existing_category)
      end
    end
  end
end
