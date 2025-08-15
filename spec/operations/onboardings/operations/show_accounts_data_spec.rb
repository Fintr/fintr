# frozen_string_literal: true

require "rails_helper"

RSpec.describe Onboardings::Operations::ShowAccountsData do
  subject(:show_accounts_data_operation) { described_class.new }

  let(:user) { create(:user) }
  let(:onboarding) { create(:onboarding, user: user) }

  describe "#validate" do
    context "when valid params" do
      let(:params) { { user_id: user.id }.with_indifferent_access }

      it "returns a successful result" do
        result = show_accounts_data_operation.validate(params)
        expect(result).to be_success
      end

      it "returns the validated params in hash" do
        result = show_accounts_data_operation.validate(params)
        expect(result.value!).to eq(user_id: user.id)
      end
    end

    context "when invalid params" do
      it "returns a failure result when user_id is missing" do
        invalid_params = { user_id: nil }.with_indifferent_access
        result = show_accounts_data_operation.validate(invalid_params)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["must be a string"])
      end
    end
  end

  describe "#call" do
    context "when onboarding exists" do
      before do
        allow(Onboarding)
          .to receive(:find_by)
          .and_return(onboarding)
      end

      context "when salary_income and business_income are present" do
        let(:onboarding_with_income) do
          create(:onboarding, user: user, data: { "income" => { "salary_income" => "1000.0", "business_income" => "500.0" } })
        end

        before do
          allow(Onboarding)
            .to receive(:find_by)
            .and_return(onboarding_with_income)
        end

        it "returns a successful result with all data" do
          result = show_accounts_data_operation.call(user_id: user.id)
          expect(result).to be_success
          expect(result.value!).to include(
            accounts_data: be_an(Array),
            account_categories: be_an(Array),
            salary_income: true,
            business_income: true
          )
        end

        it "calls find_onboarding with the correct user_id" do
          show_accounts_data_operation.call(user_id: user.id)
          expect(Onboarding).to have_received(:find_by).with(user_id: user.id)
        end
      end

      context "when salary_income and business_income are not present" do
        let(:onboarding_without_income) do
          create(:onboarding, user: user, data: { "income" => { "salary_income" => "0.0", "business_income" => "0.0" } })
        end

        before do
          allow(Onboarding)
            .to receive(:find_by)
            .and_return(onboarding_without_income)
        end

        it "returns a successful result with income flags as false" do
          result = show_accounts_data_operation.call(user_id: user.id)
          expect(result).to be_success
          expect(result.value!).to include(
            accounts_data: be_an(Array),
            account_categories: be_an(Array),
            salary_income: false,
            business_income: false
          )
        end
      end
    end

    context "when onboarding does not exist" do
      before do
        allow(Onboarding)
          .to receive(:find_by)
          .and_return(nil)
      end

      it "returns a failure result" do
        result = show_accounts_data_operation.call(user_id: user.id)
        expect(result).to be_failure
        expect(result.failure).to eq("Onboarding not found")
      end
    end

    context "when validation fails" do
      it "returns a failure result with validation errors" do
        result = show_accounts_data_operation.call(user_id: nil)
        expect(result).to be_failure
        expect(result.failure).to include(user_id: ["must be a string"])
      end
    end
  end
end
