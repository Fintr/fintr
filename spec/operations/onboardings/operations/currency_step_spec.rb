# frozen_string_literal: true

require "rails_helper"

RSpec.describe Onboardings::Operations::CurrencyStep do
  subject(:currency_step_operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space, currency: "PHP") }
  let!(:space_user) { create(:space_user, user: user, space: space) }
  let!(:onboarding) do
    # User creation automatically creates an onboarding via callback
    # Update it instead of creating a new one
    user.onboarding.update!(step: "currency")
    user.onboarding
  end

  describe "#call" do
    context "when valid params" do
      let(:params) do
        {
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          currency: "USD"
        }
      end

      before do
        show_income_data_operation = instance_double(Onboardings::Operations::ShowIncomeData)
        allow(Onboardings::Operations::ShowIncomeData)
          .to receive(:new)
          .and_return(show_income_data_operation)
        allow(show_income_data_operation)
          .to receive(:call)
          .with(user_id: user.id.to_s)
          .and_return(Dry::Monads::Success({ income: nil }))
      end

      it "returns a successful result" do
        result = currency_step_operation.call(params)
        expect(result).to be_success
      end

      it "updates the space currency" do
        currency_step_operation.call(params)
        expect(space.reload.currency).to eq("USD")
      end

      it "returns income data from ShowIncomeData operation" do
        result = currency_step_operation.call(params)
        expect(result.value!).to have_key(:income_data)
        expect(result.value![:income_data]).to eq({ income: nil })
      end
    end

    context "when currency is lowercase" do
      let(:params) do
        {
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          currency: "eur"
        }
      end

      before do
        show_income_data_operation = instance_double(Onboardings::Operations::ShowIncomeData)
        allow(Onboardings::Operations::ShowIncomeData)
          .to receive(:new)
          .and_return(show_income_data_operation)
        allow(show_income_data_operation)
          .to receive(:call)
          .and_return(Dry::Monads::Success({ income: nil }))
      end

      it "normalizes to uppercase and updates the space" do
        currency_step_operation.call(params)
        expect(space.reload.currency).to eq("EUR")
      end
    end

    context "when onboarding not found" do
      let(:params) do
        {
          user_id: SecureRandom.uuid,
          space_id: space.id.to_s,
          currency: "USD"
        }
      end

      it "returns a failure" do
        result = currency_step_operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(error: "Onboarding not found")
      end
    end

    context "when space not found" do
      let(:params) do
        {
          user_id: user.id.to_s,
          space_id: SecureRandom.uuid,
          currency: "USD"
        }
      end

      it "returns a failure" do
        result = currency_step_operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(space_id: "not found")
      end
    end

    context "when currency is invalid" do
      let(:params) do
        {
          user_id: user.id.to_s,
          space_id: space.id.to_s,
          currency: "INVALID"
        }
      end

      it "returns a failure" do
        result = currency_step_operation.call(params)
        expect(result).to be_failure
        expect(result.failure[:currency]).to be_present
      end
    end
  end
end
