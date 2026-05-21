# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Budgets::Operations::CreateBudget do
  let(:operation) { described_class.new }
  let!(:space) { create(:space) }
  let!(:category) { create(:category, space: space, category_type: 'expense', name: "Test Category - #{SecureRandom.hex(4)}") }
  let(:test_date) { Date.today }

  describe '#call' do
    subject(:call_operation) { operation.call(params) }

    context 'when the creation is successful' do
      let(:params) do
        {
          category_name: category.name,
          space_id: space.id.to_s,
          amount: 1000,
          date: test_date
        }
      end

      it { is_expected.to be_success }

      it 'creates a new budget' do
        expect { call_operation }.to change(Budget, :count).by(1)
      end

      it 'returns the created budget object' do
        result = call_operation.value!
        expect(result).to be_a(Budget)
        expect(result.category_id).to eq(category.id)
        expect(result.space_id).to eq(space.id)
        expect(result.amount_cents).to eq(1000 * 100)
        expect(result.amount_currency).to eq("PHP")
        expect(result.date).to eq(test_date)
      end
    end

    context 'with validation errors' do
      context 'when category_name is missing' do
        let(:params) do
          {
            space_id: space.id.to_s,
            amount: 1000,
            date: test_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with category_id missing error' do
          expect(call_operation.failure).to eq({ category_id: ['category_id or category_name is required'] })
        end
      end

      context 'when space_id is missing' do
        let(:params) do
          {
            category_name: category.name,
            amount: 1000,
            date: test_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with space_id missing error' do
          expect(call_operation.failure).to eq({ space_id: ['is missing'] })
        end
      end

      context 'when amount is missing' do
        let(:params) do
          {
            category_name: category.name,
            space_id: space.id.to_s,
            date: test_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with amount missing error' do
          expect(call_operation.failure).to eq({ amount: ['is missing'] })
        end
      end

      context 'when amount is not an integer' do
        let(:params) do
          {
            category_name: category.name,
            space_id: space.id.to_s,
            amount: 'not-an-integer',
            date: test_date
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with amount type error' do
          expect(call_operation.failure).to eq({ amount: ['must be an integer'] })
        end
      end

      context 'when date is missing' do
        let(:params) do
          {
            category_name: category.name,
            space_id: space.id.to_s,
            amount: 1000
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with date missing error' do
          expect(call_operation.failure).to eq({ date: ['is missing'] })
        end
      end

      context 'when date is not a valid date' do
        let(:params) do
          {
            category_name: category.name,
            space_id: space.id.to_s,
            amount: 1000,
            date: 'not-a-date'
          }
        end

        it { is_expected.to be_failure }

        it 'returns a failure with date type error' do
          expect(call_operation.failure).to eq({ date: ['must be a date'] })
        end
      end
    end

    context 'when the category is not found' do
      let(:params) do
        {
          category_name: 'non-existent-category-name',
          space_id: space.id.to_s,
          amount: 1000,
          date: test_date
        }
      end

      it { is_expected.to be_failure }

      it 'returns a failure with category_name not found error' do
        expect(call_operation.failure).to eq({ category_name: "not found" })
      end
    end

    context 'when budget.save! fails (e.g. model validation error)' do
      let(:params) do
        {
          category_name: category.name,
          space_id: space.id.to_s,
          amount: 1000,
          date: test_date
        }
      end
      let(:mock_budget_errors) { { amount_cents: ['cannot be negative'] } }
      let(:budget_instance) { build(:budget) }

      before do
        allow(Transactions::Category).to receive(:find_by!)
          .with(space_id: params[:space_id], name: params[:category_name])
          .and_return(category)

        allow(Budget).to receive(:new).and_return(budget_instance)
        allow(budget_instance).to receive(:assign_attributes)

        mock_budget_errors.each do |field, messages|
          messages.each do |message|
            budget_instance.errors.add(field.to_sym, message)
          end
        end

        allow(budget_instance).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(budget_instance))
      end

      it { is_expected.to be_failure }

      it 'returns a failure with budget errors' do
        expect(call_operation.failure).to eq(mock_budget_errors)
      end

      it 'does not create a new budget in the database' do
        expect { call_operation }.not_to change(Budget, :count)
      end
    end
  end
end
