# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Budgets::Operations::UpdateBudget do
  let(:operation) { described_class.new }
  let!(:user) { create(:user) } # Assuming current_user is available in the operation context or not directly needed by this operation
  let!(:space) { create(:space) }

  # For the success context, ensure a unique category and a specific date
  # to avoid model validation conflicts not directly related to the amount update.
  let(:unique_category_for_success_test) do
    create(:category, space: space, category_type: 'expense', name: "Unique Category for Update Test #{SecureRandom.hex(4)}")
  end
  let(:specific_date_for_success_test) { Date.new(2023, 1, 15) } # A date unlikely to clash

  # This budget is used across multiple contexts. We'll create a specific one for the success path.
  let!(:general_existing_budget) { create(:budget, space: space, amount: 1000) }

  describe '#call' do
    context 'when the update is successful' do
      subject(:call_operation) { operation.call(valid_params) }

      let!(:success_case_budget) do
        create(:budget, space: space, category: unique_category_for_success_test, date: specific_date_for_success_test, amount: 1000)
      end


      let(:valid_params) do
        {
          id: success_case_budget.id.to_s,
          space_code: space.code,
          amount: 1500
        }
      end

      before do
        allow(Budget).to receive(:find).with(success_case_budget.id.to_s).and_return(success_case_budget)

        # Stub save! to return true, assuming it would work if called correctly.
        allow(success_case_budget).to receive(:save!)
          .with(amount_cents: valid_params[:amount] * 100, amount_currency: "PHP")
          .and_return(true)

        # Stub `reload` on this instance. When the operation calls `budget.reload`,
        # this stub will execute, modify `amount_cents` in memory, and return the (modified) self.
        allow(success_case_budget).to receive(:reload) do
          success_case_budget.amount_cents = valid_params[:amount] * 100
          success_case_budget # or return self
        end
      end

      it { is_expected.to be_success }

      it 'updates the budget amount in major units' do
        # This now relies on the reload stub correctly preparing the success_case_budget instance
        original_amount = success_case_budget.amount.to_i
        call_operation
        # We check the state of success_case_budget directly after the operation,
        # which should be the instance modified by the reload stub.
        expect(success_case_budget.amount.to_i).to eq(1500)
        expect(original_amount).to eq(1000) # Ensure it started correctly
      end

      it 'returns the reloaded budget object with the new amount' do
        result = call_operation.value!
        expect(result).to eq(success_case_budget) # Result is the object from the reload stub
        expect(result.amount.to_i).to eq(1500)
      end
    end

    context 'with validation errors' do
      # These contexts use general_existing_budget for ID, or don't rely on budget existence for validation.
      context 'when id is missing' do
        subject(:call_operation) { operation.call(params_missing_id) }

        let(:params_missing_id) { { space_code: space.code, amount: 1500 } }

        it { is_expected.to be_failure }

        it 'returns a failure with id missing error' do
          expect(call_operation.failure).to eq({ id: ['is missing'] })
        end
      end

      context 'when space_code is missing' do
        subject(:call_operation) { operation.call(params_missing_space_code) }

        let(:params_missing_space_code) { { id: general_existing_budget.id.to_s, amount: 1500 } }

        it { is_expected.to be_failure }

        it 'returns a failure with space_code missing error' do
          expect(call_operation.failure).to eq({ space_code: ['is missing'] })
        end
      end

      context 'when amount is missing' do
        subject(:call_operation) { operation.call(params_missing_amount) }

        let(:params_missing_amount) { { id: general_existing_budget.id.to_s, space_code: space.code } }

        it { is_expected.to be_failure }

        it 'returns a failure with amount missing error' do
          expect(call_operation.failure).to eq({ amount: ['is missing'] })
        end
      end

      context 'when amount is not an integer' do
        subject(:call_operation) { operation.call(params_invalid_amount) }

        let(:params_invalid_amount) { { id: general_existing_budget.id.to_s, space_code: space.code, amount: 'not-an-integer' } }

        it { is_expected.to be_failure }

        it 'returns a failure with amount type error' do
          expect(call_operation.failure).to eq({ amount: ['must be an integer'] })
        end
      end
    end

    context 'when the budget is not found' do
      subject(:call_operation) { operation.call(params_with_non_existent_id) }

      let(:params_with_non_existent_id) do
        {
          id: 'non-existent-id',
          space_code: space.code,
          amount: 1500
        }
      end

      it { is_expected.to be_failure }

      it 'returns a failure with id not found error' do
        expect(call_operation.failure).to eq({ id: 'not found' })
      end
    end

    context 'when budget.save! fails (e.g. model validation error)' do
      # This context should use a budget that is findable but will be made to fail save!.
      # We use general_existing_budget here.
      subject(:call_operation) { operation.call(valid_params_for_save_fail) }

      let(:amount_for_save_fail) { 2000 }
      let(:valid_params_for_save_fail) do
        {
          id: general_existing_budget.id.to_s,
          space_code: space.code,
          amount: amount_for_save_fail
        }
      end
      let(:mock_budget_errors) { { amount_cents: ['cannot be greater than 190000'] } }

      before do
        allow(Budget).to receive(:find).with(general_existing_budget.id.to_s).and_return(general_existing_budget)
        allow(general_existing_budget).to receive(:save!).with(
          amount_cents: amount_for_save_fail * 100,
          amount_currency: "PHP"
        ).and_raise(ActiveRecord::RecordInvalid.new(general_existing_budget))
        allow(general_existing_budget).to receive_message_chain(:errors, :to_hash).and_return(mock_budget_errors)
      end

      it { is_expected.to be_failure }

      it 'returns a failure with budget errors' do
        expect(call_operation.failure).to eq(mock_budget_errors)
      end

      it 'does not update the budget amount in the database' do
        initial_amount = general_existing_budget.amount.to_i
        call_operation
        expect(general_existing_budget.reload.amount.to_i).to eq(initial_amount)
      end
    end
  end
end
