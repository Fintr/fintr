# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Transactions::Operations::Loans::FindOrCreateInterestCategory do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }

  describe '#call' do
    context 'with invalid parameters' do
      context 'when space_id is missing' do
        subject(:call_operation) { operation.call({ loan_type: 'borrowed' }) }

        it { is_expected.to be_failure }

        it 'returns a failure with space_id missing error' do
          expect(call_operation.failure[:error]).to have_key(:space_id)
        end
      end

      context 'when loan_type is missing' do
        subject(:call_operation) { operation.call({ space_id: space.id.to_s }) }

        it { is_expected.to be_failure }

        it 'returns a failure with loan_type missing error' do
          expect(call_operation.failure[:error]).to have_key(:loan_type)
        end
      end

      context 'when loan_type is invalid' do
        subject(:call_operation) { operation.call({ space_id: space.id.to_s, loan_type: 'invalid' }) }

        it { is_expected.to be_failure }

        it 'returns a failure with loan_type validation error' do
          expect(call_operation.failure[:error]).to have_key(:loan_type)
        end
      end
    end

    context 'with valid parameters' do
      context 'when loan_type is "borrowed"' do
        subject(:call_operation) do
          operation.call(
            space_id: space.id.to_s,
            loan_type: 'borrowed'
          )
        end

        context 'when category does not exist' do
          it { is_expected.to be_success }

          it 'creates a new category' do
            expect { call_operation }.to change(Transactions::Category, :count).by(1)
          end

          it 'creates category with correct name' do
            result = call_operation.value!
            expect(result.name).to eq('Interest Expense')
          end

          it 'creates category with expense type' do
            result = call_operation.value!
            expect(result.category_type).to eq('expense')
          end

          it 'creates category with correct space_id' do
            result = call_operation.value!
            expect(result.space_id).to eq(space.id)
          end

          it 'returns a Category object' do
            expect(call_operation.value!).to be_a(Transactions::Category)
          end
        end

        context 'when category already exists' do
          let!(:existing_category) do
            create(
              :category,
              space: space,
              name: 'Interest Expense',
              category_type: 'expense'
            )
          end

          it { is_expected.to be_success }

          it 'does not create a new category' do
            expect { call_operation }.not_to change(Transactions::Category, :count)
          end

          it 'returns the existing category' do
            result = call_operation.value!
            expect(result.id).to eq(existing_category.id)
          end

          it 'returns category with correct name' do
            result = call_operation.value!
            expect(result.name).to eq('Interest Expense')
          end

          it 'returns category with expense type' do
            result = call_operation.value!
            expect(result.category_type).to eq('expense')
          end
        end
      end

      context 'when loan_type is "lent"' do
        subject(:call_operation) do
          operation.call(
            space_id: space.id.to_s,
            loan_type: 'lent'
          )
        end

        context 'when category does not exist' do
          it { is_expected.to be_success }

          it 'creates a new category' do
            expect { call_operation }.to change(Transactions::Category, :count).by(1)
          end

          it 'creates category with correct name' do
            result = call_operation.value!
            expect(result.name).to eq('Interest Income')
          end

          it 'creates category with income type' do
            result = call_operation.value!
            expect(result.category_type).to eq('income')
          end

          it 'creates category with correct space_id' do
            result = call_operation.value!
            expect(result.space_id).to eq(space.id)
          end

          it 'returns a Category object' do
            expect(call_operation.value!).to be_a(Transactions::Category)
          end
        end

        context 'when category already exists' do
          let!(:existing_category) do
            create(
              :category,
              space: space,
              name: 'Interest Income',
              category_type: 'income'
            )
          end

          it { is_expected.to be_success }

          it 'does not create a new category' do
            expect { call_operation }.not_to change(Transactions::Category, :count)
          end

          it 'returns the existing category' do
            result = call_operation.value!
            expect(result.id).to eq(existing_category.id)
          end

          it 'returns category with correct name' do
            result = call_operation.value!
            expect(result.name).to eq('Interest Income')
          end

          it 'returns category with income type' do
            result = call_operation.value!
            expect(result.category_type).to eq('income')
          end
        end
      end

      context 'when category with same name but different type exists' do
        subject(:call_operation) do
          operation.call(
            space_id: space.id.to_s,
            loan_type: 'borrowed'
          )
        end

        let!(:existing_category) do
          create(
            :category,
            space: space,
            name: 'Interest Expense',
            category_type: 'income' # Different type
          )
        end

        it { is_expected.to be_success }

        it 'creates a new category' do
          expect { call_operation }.to change(Transactions::Category, :count).by(1)
        end

        it 'creates category with expense type' do
          result = call_operation.value!
          expect(result.category_type).to eq('expense')
          expect(result.id).not_to eq(existing_category.id)
        end
      end

      context 'when category with same type but different name exists' do
        subject(:call_operation) do
          operation.call(
            space_id: space.id.to_s,
            loan_type: 'borrowed'
          )
        end

        let!(:existing_category) do
          create(
            :category,
            space: space,
            name: 'Some Other Expense',
            category_type: 'expense'
          )
        end

        it { is_expected.to be_success }

        it 'creates a new category' do
          expect { call_operation }.to change(Transactions::Category, :count).by(1)
        end

        it 'creates category with Interest Expense name' do
          result = call_operation.value!
          expect(result.name).to eq('Interest Expense')
          expect(result.id).not_to eq(existing_category.id)
        end
      end

      context 'when category exists in a different space' do
        subject(:call_operation) do
          operation.call(
            space_id: space.id.to_s,
            loan_type: 'borrowed'
          )
        end

        let(:other_space) { create(:personal_space) }

        let!(:existing_category) do
          create(
            :category,
            space: other_space,
            name: 'Interest Expense',
            category_type: 'expense'
          )
        end

        it { is_expected.to be_success }

        it 'creates a new category for the current space' do
          expect { call_operation }.to change(Transactions::Category, :count).by(1)
        end

        it 'creates category with correct space_id' do
          result = call_operation.value!
          expect(result.space_id).to eq(space.id)
          expect(result.id).not_to eq(existing_category.id)
        end
      end
    end
  end
end
