# frozen_string_literal: true

require "rails_helper"

RSpec.describe Onboardings::Operations::AccountsStep do
  subject(:accounts_step_operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let!(:space_user) { create(:space_user, user: user, space: space) }

  let(:valid_params) do
    {
      user_id: user.id,
      space_id: space.id,
      accounts: [
        { name: "Cash", balance: 1000.00, account_category: "cash_account", for_salary: true },
        { name: "Savings", balance: 5000.00, account_category: "bank_account", for_business: true }
      ]
    }
  end

  describe "#validate" do
    context "when valid params" do
      it "returns a successful result" do
        result = accounts_step_operation.validate(valid_params)
        expect(result).to be_success
      end

      it "returns the validated params in hash" do
        result = accounts_step_operation.validate(valid_params)
        expect(result.value!).to eq(valid_params)
      end
    end

    context "when invalid params" do
      it "returns a failure result when user_id is missing" do
        invalid_params = valid_params.except(:user_id)
        result = accounts_step_operation.validate(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["is missing"])
      end

      it "returns a failure result when space_id is missing" do
        invalid_params = valid_params.except(:space_id)
        result = accounts_step_operation.validate(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(space_id: ["is missing"])
      end

      it "returns a failure result when accounts is missing" do
        invalid_params = valid_params.except(:accounts)
        result = accounts_step_operation.validate(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(accounts: ["is missing"])
      end

      it "returns a failure result when accounts is not an array" do
        invalid_params = valid_params.merge(accounts: "not an array")
        result = accounts_step_operation.validate(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(accounts: ["must be an array"])
      end
    end
  end

  describe "#call" do
    let(:onboarding_with_all_data_attributes) do
      {
        id: SecureRandom.uuid,
        user: user,
        step: "income",
        data: ActiveSupport::HashWithIndifferentAccess.new({
          "budgets" => [{ "name" => "Home", "amount" => "1000.0" }],
          "income" => { "salary_income" => "1000.0", "business_income" => "500.0" }
        })
      }
    end

    let(:onboarding_with_all_data) do
      instance_double(Onboarding, **onboarding_with_all_data_attributes)
    end

    before do
      # Stub Onboarding.find_by to return our controlled double
      allow(Onboarding).to receive(:find_by).with(user_id: user.id).and_return(onboarding_with_all_data)

      # Stub update! on the double
      allow(onboarding_with_all_data).to receive(:update!).and_return(true)

      # Stub nested operations that are not part of the current operation's direct responsibility
      allow(Transactions::Operations::Accounts::CreateAccount)
        .to receive(:new)
        .and_return(instance_double(Transactions::Operations::Accounts::CreateAccount, call: Dry::Monads::Success(true)))

      allow(Transactions::Operations::Categories::CreateCategory)
        .to receive(:new)
        .and_return(instance_double(Transactions::Operations::Categories::CreateCategory, call: Dry::Monads::Success(true)))

      allow(Budgets::Operations::CreateBudget)
        .to receive(:new)
        .and_return(instance_double(Budgets::Operations::CreateBudget, call: Dry::Monads::Success(true)))

      allow(Transactions::Operations::CreateTransaction)
        .to receive(:new)
        .and_return(instance_double(Transactions::Operations::CreateTransaction, call: Dry::Monads::Success(true)))
    end

    context "when valid params and existing onboarding" do
      it "returns a successful result" do
        result = accounts_step_operation.call(valid_params)
        expect(result).to be_success
      end

      it "updates the onboarding with account data" do
        accounts_step_operation.call(valid_params)
        expected_data = onboarding_with_all_data.data.merge(
          accounts: valid_params[:accounts].map do |account|
            account.except(:for_salary, :for_business).merge(balance: account[:balance].to_s).deep_stringify_keys
          end
        )
        expect(onboarding_with_all_data).to have_received(:update!).with(
          step: "completed",
          data: expected_data
        )
      end

      it "calls CreateAccount for each account" do
        accounts_step_operation.call(valid_params)
        valid_params[:accounts].each do |account|
          expect(Transactions::Operations::Accounts::CreateAccount)
            .to have_received(:new).at_least(:once)
          expect(Transactions::Operations::Accounts::CreateAccount.new)
            .to have_received(:call)
            .with(
              user_id: user.id,
              space_id: space.id,
              name: account[:name],
              balance: account[:balance].to_d,
              account_category: account[:account_category],
              accounts: valid_params[:accounts]
            ).at_least(:once)
        end
      end

      it "calls CreateCategory for each budget category" do
        accounts_step_operation.call(valid_params)
        expect(Transactions::Operations::Categories::CreateCategory)
          .to have_received(:new)
        expect(Transactions::Operations::Categories::CreateCategory.new)
          .to have_received(:call)
          .with(
            user_id: user.id,
            space_id: space.id,
            name: "Home",
            category_type: "expense",
            accounts: valid_params[:accounts]
          )
      end

      it "calls CreateBudget for each budget" do
        accounts_step_operation.call(valid_params)
        expect(Budgets::Operations::CreateBudget)
          .to have_received(:new)
        expect(Budgets::Operations::CreateBudget.new)
          .to have_received(:call)
          .with(
            user_id: user.id,
            space_id: space.id,
            category_name: "Home",
            date: Date.current,
            amount: 1000.0.to_d,
            accounts: valid_params[:accounts]
          )
      end

      it "calls CreateTransaction for salary income" do
        accounts_step_operation.call(valid_params)
        expect(Transactions::Operations::CreateTransaction)
          .to have_received(:new).at_least(:once)
        expect(Transactions::Operations::CreateTransaction.new)
          .to have_received(:call)
          .with(
            user_id: user.id,
            space_id: space.id,
            category_name: "Salary",
            account_name: "Cash", # Assuming 'Cash' is for salary
            date: Date.current.beginning_of_month,
            amount: 1000.0.to_d,
            remove_calculation: true,
            schedule_type: "repeat",
            repeat_interval: "every_month",
            accounts: valid_params[:accounts]
          )
      end

      it "calls CreateTransaction for business income" do
        accounts_step_operation.call(valid_params)
        expect(Transactions::Operations::CreateTransaction)
          .to have_received(:new).at_least(:once)
        expect(Transactions::Operations::CreateTransaction.new)
          .to have_received(:call)
          .with(
            user_id: user.id,
            space_id: space.id,
            category_name: "Business",
            account_name: "Savings", # Assuming 'Savings' is for business
            date: Date.current.beginning_of_month,
            amount: 500.0.to_d,
            remove_calculation: true,
            schedule_type: "repeat",
            repeat_interval: "every_month",
            accounts: valid_params[:accounts]
          )
      end
    end

    context "when user not found" do
      before do
        allow(Onboarding).to receive(:find_by).with(user_id: valid_params[:user_id]).and_return(nil)
      end

      it "returns a failure result" do
        result = accounts_step_operation.call(valid_params)
        expect(result).to be_failure
        expect(result.failure).to eq(error: "Onboarding not found")
      end
    end

    context "when validation fails" do
      it "returns a failure result with validation errors" do
        invalid_params = valid_params.except(:user_id)
        result = accounts_step_operation.call(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["is missing"])
      end
    end
  end
end
