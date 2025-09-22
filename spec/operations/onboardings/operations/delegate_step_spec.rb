# frozen_string_literal: true

require "rails_helper"

RSpec.describe Onboardings::Operations::DelegateStep do
  subject(:delegate_step_operation) { described_class.new }

  let(:user) { create(:user) }

  describe "#call" do
    context "when action is 'show'" do
      context "when step is 'budgets'" do
        let(:params) { { user_id: user.id, step: "budgets", action: "show" }.with_indifferent_access }
        let(:budgets_data) do
          [
            { "name" => "Home", "amount" => 1200.00, "percentage" => 20 },
            { "name" => "Food & Groceries", "amount" => 1200.00, "percentage" => 20 }
          ]
        end
        let(:income_data) do
          { "salary_income" => 1000.00, "business_income" => 500.00 }
        end

        before do
          show_budgets_data_operation = instance_double(Onboardings::Operations::ShowBudgetsData)
          show_income_data_operation = instance_double(Onboardings::Operations::ShowIncomeData)
          allow(Onboardings::Operations::ShowBudgetsData)
            .to receive(:new)
            .and_return(show_budgets_data_operation)
          allow(Onboardings::Operations::ShowIncomeData)
            .to receive(:new)
            .and_return(show_income_data_operation)
          allow(show_budgets_data_operation)
            .to receive(:call)
            .with(params)
            .and_return(Dry::Monads::Success(budgets_data))
          allow(show_income_data_operation)
            .to receive(:call)
            .with(params)
            .and_return(Dry::Monads::Success(income_data))
        end

        it "returns a successful result with budgets data" do
          result = delegate_step_operation.call(params)
          expect(result).to be_success
          expect(result.value!).to eq(budgets_data: budgets_data, income_data: income_data)
        end

        it "calls ShowBudgetsData operation" do
          delegate_step_operation.call(params)
          expect(Onboardings::Operations::ShowBudgetsData).to have_received(:new)
        end
      end

      context "when step is 'accounts'" do
        let(:params) { { step: "accounts", action: "show" }.with_indifferent_access }
        let(:accounts_data_from_show_accounts_data) do
          { accounts_data: [
            { "name" => "Cash", "balance" => 1000.00, "type" => "current" },
            { "name" => "Savings", "balance" => 5000.00, "type" => "savings" }
          ],
            account_categories: [
              { "label" => "Cash Account", "value" => "cash_account" },
              { "label" => "Bank Account", "value" => "bank_account" }
            ] }
        end

        before do
          show_accounts_data_operation = instance_double(Onboardings::Operations::ShowAccountsData)
          allow(Onboardings::Operations::ShowAccountsData)
            .to receive(:new)
            .and_return(show_accounts_data_operation)
          allow(show_accounts_data_operation)
            .to receive(:call)
            .and_return(Dry::Monads::Success(accounts_data_from_show_accounts_data))
        end

        it "returns a successful result with accounts data" do
          result = delegate_step_operation.call(params)
          expect(result).to be_success
          expect(result.value!).to eq(accounts_data_from_show_accounts_data)
        end

        it "calls ShowAccountsData operation" do
          delegate_step_operation.call(params)
          expect(Onboardings::Operations::ShowAccountsData).to have_received(:new)
        end
      end
    end

    context "when action is 'create'" do
      context "when step is 'income'" do
        let(:params) { { user_id: user.id, step: "income", action: "create" }.with_indifferent_access }
        let(:income_data_from_income_step) { { budgets_data: "some_budgets_data" } }

        before do
          income_step_operation = instance_double(Onboardings::Operations::IncomeStep)
          allow(Onboardings::Operations::IncomeStep)
            .to receive(:new)
            .and_return(income_step_operation)
          allow(income_step_operation)
            .to receive(:call)
            .with(params)
            .and_return(Dry::Monads::Success(income_data_from_income_step))
        end

        it "returns a successful result with income data" do
          result = delegate_step_operation.call(params)
          expect(result).to be_success
          expect(result.value!).to eq(income_data_from_income_step)
        end

        it "calls IncomeStep operation" do
          delegate_step_operation.call(params)
          expect(Onboardings::Operations::IncomeStep).to have_received(:new)
        end
      end

      context "when step is 'budgets'" do
        let(:params) { { user_id: user.id, step: "budgets", action: "create" }.with_indifferent_access }
        let(:budgets_creation_data_from_budgets_step) { { accounts_data: "some_accounts_data" } }

        before do
          budgets_step_operation = instance_double(Onboardings::Operations::BudgetsStep)
          allow(Onboardings::Operations::BudgetsStep)
            .to receive(:new)
            .and_return(budgets_step_operation)
          allow(budgets_step_operation)
            .to receive(:call)
            .with(params)
            .and_return(Dry::Monads::Success(budgets_creation_data_from_budgets_step))
        end

        it "returns a successful result with budgets creation data" do
          result = delegate_step_operation.call(params)
          expect(result).to be_success
          expect(result.value!).to eq(budgets_creation_data_from_budgets_step)
        end

        it "calls BudgetsStep operation" do
          delegate_step_operation.call(params)
          expect(Onboardings::Operations::BudgetsStep).to have_received(:new)
        end
      end
    end

    context "when invalid action" do
      let(:params) { { step: "income", action: "invalid_action" }.with_indifferent_access }

      it "returns a failure result" do
        result = delegate_step_operation.call(params)
        expect(result).to be_success
        expect(result.value!).to be_failure
      end

      it "returns an 'Invalid action' error" do
        result = delegate_step_operation.call(params)
        expect(result.value!.failure).to eq("Invalid action")
      end
    end

    context "when invalid step in show_data" do
      let(:params) { { step: "invalid_step", action: "show" }.with_indifferent_access }

      it "returns a failure result" do
        result = delegate_step_operation.call(params)
        expect(result).to be_failure
      end

      it "returns an 'Invalid step for show action' error" do
        result = delegate_step_operation.call(params)
        expect(result.failure).to eq("Invalid step for show action")
      end
    end
  end
end
