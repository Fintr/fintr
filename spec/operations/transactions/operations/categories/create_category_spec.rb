# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Categories::CreateCategory do
  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }

  describe '#call' do
    context 'with valid parameters' do
      subject(:call_operation) { operation.call(params:) }

      let(:params) do
        {
          space_id: space.id,
          name: "Entertainment",
          category_type: "expense"
        }
      end

      it { is_expected.to be_success }

      it 'creates a new category' do
        expect { call_operation }.to change(Transactions::Category, :count).by(1)
      end

      it 'sets the category attributes correctly' do
        result = call_operation.value!

        expect(result).to be_a(Transactions::Category)
        expect(result.name).to eq("Entertainment")
        expect(result.category_type).to eq("expense")
        expect(result.space_id).to eq(space.id)
      end

      context 'when creating a category with the same name but different type' do
        before do
          create(:category, name: "Entertainment", category_type: "income", space:)
        end

        it { is_expected.to be_success }

        it 'creates a new category' do
          expect { call_operation }.to change(Transactions::Category, :count).by(1)
        end
      end
    end

    context 'with invalid parameters' do
      context 'when name is blank' do
        subject(:call_operation) { operation.call(params:) }

        let(:params) do
          {
            space_id: space.id,
            name: "",
            category_type: "expense"
          }
        end

        it { is_expected.to be_failure }

        it 'does not create a category' do
          expect { call_operation }.not_to change(Transactions::Category, :count)
        end

        it 'returns validation errors' do
          result = call_operation
          expect(result.failure).to include(:name)
        end
      end

      context 'when category_type is invalid' do
        subject(:call_operation) { operation.call(params:) }

        let(:params) do
          {
            space_id: space.id,
            name: "Entertainment",
            category_type: "invalid_type"
          }
        end

        it { is_expected.to be_failure }

        it 'does not create a category' do
          expect { call_operation }.not_to change(Transactions::Category, :count)
        end

        it 'returns validation errors' do
          result = call_operation
          expect(result.failure).to include(:category_type)
          expect(result.failure[:category_type]).to include("must be either 'expense' or 'income'")
        end
      end

      context 'when category with the same name and type already exists' do
        subject(:call_operation) { operation.call(params:) }

        let(:params) do
          {
            space_id: space.id,
            name: "Entertainment",
            category_type: "expense"
          }
        end

        before do
          create(:category, name: "Entertainment", category_type: "expense", space:)
        end

        it { is_expected.to be_failure }

        it 'does not create a category' do
          expect { call_operation }.not_to change(Transactions::Category, :count)
        end

        it 'returns a uniqueness error' do
          result = call_operation
          expect(result.failure).to include(:name)
          expect(result.failure[:name]).to include("already exists for this space and type")
        end
      end
    end
  end
end
