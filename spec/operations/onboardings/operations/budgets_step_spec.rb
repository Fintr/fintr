# frozen_string_literal: true

require "rails_helper"

RSpec.describe Onboardings::Operations::BudgetsStep do
  subject(:budgets_step_operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let!(:space_user) { create(:space_user, user: user, space: space) }
  let(:onboarding) { create(:onboarding, user: user) }

  let(:valid_params) do
    {
      user_id: user.id,
      space_id: space.id,
      budget_categories: [
        { name: "Home", amount: 800.00 },
        { name: "Food & Groceries", amount: 500.00 }
      ]
    }
  end

  describe "#validate" do
    context "when valid params" do
      it "returns a successful result" do
        result = budgets_step_operation.validate(valid_params)
        expect(result).to be_success
      end

      it "returns the validated params in hash" do
        result = budgets_step_operation.validate(valid_params)
        expect(result.value!).to eq(valid_params)
      end
    end

    context "when invalid params" do
      it "returns a failure result when user_id is missing" do
        invalid_params = valid_params.except(:user_id)
        result = budgets_step_operation.validate(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["is missing"])
      end

      it "returns a failure result when space_id is missing" do
        invalid_params = valid_params.except(:space_id)
        result = budgets_step_operation.validate(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(space_id: ["is missing"])
      end

      it "returns a failure result when budget_categories is missing" do
        invalid_params = valid_params.except(:budget_categories)
        result = budgets_step_operation.validate(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(budget_categories: ["is missing"])
      end

      it "returns a failure result when budget_categories is not an array" do
        invalid_params = valid_params.merge(budget_categories: "not an array")
        result = budgets_step_operation.validate(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(budget_categories: ["must be an array"])
      end
    end
  end

  describe "#call" do
    context "when valid params and existing onboarding" do
      before do
        allow(Auth::User)
          .to receive(:find_by)
          .with(id: user.id)
          .and_return(user)

        allow(user)
          .to receive(:onboarding)
          .and_return(onboarding)

        allow(onboarding)
          .to receive(:update!)
          .and_return(true)

        allow(Onboardings::Operations::ShowAccountsData)
          .to receive(:new)
          .and_return(instance_double(Onboardings::Operations::ShowAccountsData, call: Dry::Monads::Success("accounts_data")))
      end

      it "returns a successful result" do
        result = budgets_step_operation.call(valid_params)
        expect(result).to be_success
      end

      it "updates the onboarding with budget data" do
        budgets_step_operation.call(valid_params)
        expect(onboarding).to have_received(:update!).with(
          data: onboarding.data.merge(
            "budgets" => valid_params[:budget_categories].map(&:deep_stringify_keys)
          )
        )
      end

      it "updates the onboarding step to accounts" do
        budgets_step_operation.call(valid_params)
        expect(onboarding).to have_received(:update!).with(step: "accounts")
      end

      it "calls ShowAccountsData operation" do
        show_accounts_data_operation = instance_double(Onboardings::Operations::ShowAccountsData)
        allow(Onboardings::Operations::ShowAccountsData)
          .to receive(:new)
          .and_return(show_accounts_data_operation)
        allow(show_accounts_data_operation)
          .to receive(:call)
          .and_return(Dry::Monads::Success("accounts_data"))

        result = budgets_step_operation.call(valid_params)
        expect(show_accounts_data_operation).to have_received(:call)
        expect(result.value!).to eq("accounts_data")
      end
    end

    context "when user not found" do
      before do
        allow(Auth::User)
          .to receive(:find_by)
          .with(id: user.id)
          .and_return(nil)
      end

      it "returns a failure result" do
        result = budgets_step_operation.call(valid_params)
        expect(result).to be_failure
      end

      it "returns a user not found error" do
        result = budgets_step_operation.call(valid_params)
        expect(result.failure).to include(user_id: "User not found")
      end
    end

    context "when onboarding not found" do
      before do
        allow(Auth::User)
          .to receive(:find_by)
          .with(id: user.id)
          .and_return(user)

        allow(user)
          .to receive(:onboarding)
          .and_return(nil)
      end

      it "returns a failure result" do
        result = budgets_step_operation.call(valid_params)
        expect(result).to be_failure
      end

      it "returns an onboarding not found error" do
        result = budgets_step_operation.call(valid_params)
        expect(result.failure).to include(user_id: "Onboarding not found")
      end
    end

    context "when invalid params" do
      let(:invalid_params) do
        {
          user_id: user.id,
          space_id: space.id,
          budget_categories: "not an array"
        }
      end

      before do
        allow(Auth::User)
          .to receive(:find_by)
          .with(id: user.id)
          .and_return(user)

        allow(user)
          .to receive(:onboarding)
          .and_return(onboarding)
      end

      it "returns a failure result" do
        result = budgets_step_operation.call(invalid_params)
        expect(result).to be_failure
      end

      it "returns errors for invalid budget_categories" do
        result = budgets_step_operation.call(invalid_params)
        expect(result.failure).to include(budget_categories: ["must be an array"])
      end
    end
  end
end
