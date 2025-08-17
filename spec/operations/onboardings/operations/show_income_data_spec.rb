# frozen_string_literal: true

require "rails_helper"

RSpec.describe Onboardings::Operations::ShowIncomeData do
  subject(:show_income_data_operation) { described_class.new }

  let(:user) { create(:user) }
  let(:valid_params) { { user_id: user.id } }

  describe "#validate" do
    context "when valid params" do
      it "returns a successful result" do
        result = show_income_data_operation.validate(valid_params)
        expect(result).to be_success
      end

      it "returns the validated params" do
        result = show_income_data_operation.validate(valid_params)
        expect(result.value!).to eq(valid_params)
      end
    end

    context "when invalid params" do
      it "returns a failure result when user_id is missing" do
        invalid_params = { invalid_key: "invalid_value" }
        result = show_income_data_operation.validate(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["is missing"])
      end
    end
  end

  describe "#call" do
    let(:onboarding_data) do
      {
        "income" => {
          "salary_income" => 5000,
          "business_income" => 1000
        }
      }
    end
    let(:onboarding) { create(:onboarding, user: user, data: onboarding_data) }

    before do
      allow(Onboarding)
        .to receive(:find_by)
        .with(user_id: user.id)
        .and_return(onboarding)
    end

    context "when valid params and onboarding exists" do
      it "returns a successful result with income data" do
        result = show_income_data_operation.call(valid_params)
        expect(result).to be_success
        expect(result.value!).to eq(
          salary_income: onboarding_data["income"]["salary_income"],
          business_income: onboarding_data["income"]["business_income"]
        )
      end

      it "calls Onboarding.find_by" do
        show_income_data_operation.call(valid_params)
        expect(Onboarding).to have_received(:find_by).with(user_id: user.id)
      end
    end

    context "when onboarding not found" do
      before do
        allow(Onboarding)
          .to receive(:find_by)
          .and_return(nil)
      end

      it "returns a failure result" do
        result = show_income_data_operation.call(valid_params)
        expect(result).to be_failure
      end

      it "returns an 'Onboarding not found' error" do
        result = show_income_data_operation.call(valid_params)
        expect(result.failure).to eq("Onboarding not found")
      end
    end
  end
end
