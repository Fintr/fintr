# frozen_string_literal: true

require "rails_helper"

RSpec.describe Onboardings::Operations::IncomeStep do
  subject(:income_step_operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let!(:space_user) { create(:space_user, user: user, space: space) }

  let(:onboarding) { create(:onboarding, user: user) }

  describe "#call" do
    context "when valid params" do
      let(:params) do
        {
          user_id: user.id,
          space_id: space.id,
          salary_income: 1000.00,
          business_income: 500.00
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

        show_budgets_data_operation = instance_double(Onboardings::Operations::ShowBudgetsData)
        allow(Onboardings::Operations::ShowBudgetsData)
          .to receive(:new)
          .and_return(show_budgets_data_operation)
        allow(show_budgets_data_operation)
          .to receive(:call)
          .with(user_id: user.id)
          .and_return(Dry::Monads::Success("budget_data"))
      end

      it "returns a successful result" do
        result = income_step_operation.call(params)
        expect(result).to be_success
      end

      it "updates the onboarding with income data" do
        income_step_operation.call(params)
        updated_onboarding = Onboarding.find(onboarding.id)
        expect(updated_onboarding.data["income"]).to eq(
          "salary_income" => params[:salary_income].to_s,
          "business_income" => params[:business_income].to_s
        )
      end

      it "updates the onboarding step to budgets" do
        income_step_operation.call(params)
        updated_onboarding = Onboarding.find(onboarding.id)
        expect(updated_onboarding.step).to eq("budgets")
      end

      it "calls ShowBudgetsData operation with user_id" do
        show_budgets_data_operation = instance_double(Onboardings::Operations::ShowBudgetsData)
        allow(Onboardings::Operations::ShowBudgetsData)
          .to receive(:new)
          .and_return(show_budgets_data_operation)
        allow(show_budgets_data_operation)
          .to receive(:call)
          .with(user_id: user.id)
          .and_return(Dry::Monads::Success("budget_data"))

        income_step_operation.call(params)

        expect(show_budgets_data_operation).to have_received(:call).with(user_id: user.id)
      end
    end

    context "when user has no existing onboarding" do
      let(:user_without_onboarding) { create(:user) }
      let(:params) do
        {
          user_id: user_without_onboarding.id,
          space_id: space.id,
          salary_income: 2000.00,
          business_income: 1000.00
        }
      end

      it "creates a new onboarding record" do
        expect { income_step_operation.call(params) }
          .to change(Onboarding, :count).by(1)
      end

      it "creates onboarding with correct user and final step" do
        income_step_operation.call(params)
        created_onboarding = user_without_onboarding.reload.onboarding
        expect(created_onboarding.user).to eq(user_without_onboarding)
        expect(created_onboarding.step).to eq("budgets")
      end

      it "stores income data in the new onboarding" do
        income_step_operation.call(params)
        created_onboarding = user_without_onboarding.reload.onboarding
        expect(created_onboarding.data["income"]).to eq(
          "salary_income" => params[:salary_income].to_s,
          "business_income" => params[:business_income].to_s
        )
      end
    end

    context "when invalid params" do
      let(:params) do
        {
          user_id: user.id,
          space_id: space.id,
          salary_income: nil,
          business_income: nil
        }
      end

      it "returns a failure result" do
        result = income_step_operation.call(params)
        expect(result).to be_failure
      end

      it "returns errors for missing income" do
        result = income_step_operation.call(params)
        expect(result.failure).to include(
          salary_income: ["must be a decimal"],
          business_income: ["must be a decimal"]
        )
      end
    end

    context "when user not found" do
      let(:params) do
        {
          user_id: "non_existent_user_id",
          space_id: space.id,
          salary_income: 1000.00,
          business_income: 500.00
        }
      end

      before do
        allow(Auth::User)
          .to receive(:find_by)
          .with(id: "non_existent_user_id")
          .and_return(nil)
      end

      it "returns a failure result" do
        result = income_step_operation.call(params)
        expect(result).to be_failure
      end

      it "returns a user not found error" do
        result = income_step_operation.call(params)
        expect(result.failure).to include(user_id: "User not found")
      end
    end
  end
end
