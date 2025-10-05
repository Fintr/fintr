# frozen_string_literal: true

require "rails_helper"

RSpec.describe Onboardings::Operations::ShowBudgetsData do
  subject(:show_budgets_data_operation) { described_class.new }

  let(:user) { create(:user) }
  let(:onboarding_with_income) do
    create(:onboarding,
           user: user,
           data: {
             "income" => "6000.00"
           })
  end

  let(:onboarding_without_income) do
    create(:onboarding,
           user: user,
           data: {
             "income" => nil
           })
  end

  let(:onboarding_empty_income) do
    create(:onboarding,
           user: user,
           data: {
             "income" => {}
           })
  end

  describe "#validate" do
    context "when valid params" do
      let(:params) do
        {
          user_id: user.id
        }
      end

      it "returns a successful result" do
        result = show_budgets_data_operation.validate(params)
        expect(result).to be_success
      end

      it "returns the validated user_id in hash" do
        result = show_budgets_data_operation.validate(params)
        expect(result.value!).to eq(user_id: user.id)
      end
    end

    context "when invalid params" do
      let(:params) do
        {
          user_id: nil
        }
      end

      it "returns a failure result" do
        result = show_budgets_data_operation.validate(params)
        expect(result).to be_failure
      end

      it "returns errors for invalid user_id" do
        result = show_budgets_data_operation.validate(params)
        expect(result.failure).to include(user_id: ["must be a string"])
      end
    end
  end

  describe "#call" do
    context "when user has onboarding with income data" do
      let(:params) do
        {
          user_id: user.id
        }
      end

      before do
        allow(Onboarding)
          .to receive(:find_by)
          .with(user_id: user.id)
          .and_return(onboarding_with_income)
      end

      it "returns a successful result" do
        result = show_budgets_data_operation.call(params)
        expect(result).to be_success
      end

      it "returns the calculated budget data" do
        result = show_budgets_data_operation.call(params)
        expected_data = [
          { name: "Home", amount: 1500.00, percentage: 25 },
          { name: "Food & Groceries", amount: 600.00, percentage: 10 },
          { name: "Utilities", amount: 300.00, percentage: 5 },
          { name: "Transportation", amount: 300.00, percentage: 5 },
          { name: "Insurance", amount: 300.00, percentage: 5 },
          { name: "Dine Out & Entertainment", amount: 600.00, percentage: 10 },
          { name: "Shopping", amount: 600.00, percentage: 10 },
          { name: "Subscriptions & Hobbies", amount: 300.00, percentage: 5 },
          { name: "Travel & Vacations", amount: 300.00, percentage: 5 }
        ]
        expect(result.value!).to match_array(expected_data)
      end
    end

    context "when user has no onboarding" do
      let(:params) do
        {
          user_id: user.id
        }
      end

      before do
        allow(Onboarding)
          .to receive(:find_by)
          .with(user_id: user.id)
          .and_return(nil)
      end

      it "returns a failure result" do
        result = show_budgets_data_operation.call(params)
        expect(result).to be_failure
      end

      it "returns an error for missing onboarding" do
        result = show_budgets_data_operation.call(params)
        expect(result.failure).to eq("Onboarding not found")
      end
    end

    context "when user has onboarding without income data" do
      let(:params) do
        {
          user_id: user.id
        }
      end

      before do
        allow(Onboarding)
          .to receive(:find_by)
          .with(user_id: user.id)
          .and_return(onboarding_without_income)
      end

      it "returns a failure result" do
        result = show_budgets_data_operation.call(params)
        expect(result).to be_failure
      end

      it "returns an error for missing income data" do
        result = show_budgets_data_operation.call(params)
        expect(result.failure).to eq("Onboarding data not found")
      end
    end

    context "when user has onboarding with empty income data" do
      let(:params) do
        {
          user_id: user.id
        }
      end

      before do
        allow(Onboarding)
          .to receive(:find_by)
          .with(user_id: user.id)
          .and_return(onboarding_empty_income)
      end

      it "returns a failure result" do
        result = show_budgets_data_operation.call(params)
        expect(result).to be_failure
      end

      it "returns an error for missing income data" do
        result = show_budgets_data_operation.call(params)
        expect(result.failure).to eq("Onboarding data not found")
      end
    end
  end
end
