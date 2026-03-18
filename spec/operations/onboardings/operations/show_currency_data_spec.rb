# frozen_string_literal: true

require "rails_helper"

RSpec.describe Onboardings::Operations::ShowCurrencyData do
  subject(:show_currency_data_operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space, currency: "JPY") }
  let!(:space_user) { create(:space_user, user: user, space: space) }
  let!(:onboarding) do
    # User creation automatically creates an onboarding via callback
    # Update it instead of creating a new one
    user.onboarding.update!(step: "currency", data: { "currency" => "PHP" })
    user.onboarding
  end

  describe "#call" do
    context "when valid params and onboarding exists" do
      let(:params) do
        {
          user_id: user.id.to_s,
          space_id: space.id.to_s
        }
      end

      it "returns success with currency data" do
        result = show_currency_data_operation.call(params)
        expect(result).to be_success
        expect(result.value!).to include(
          currency: "JPY",
          stored_currency: "PHP"
        )
      end
    end

    context "when onboarding does not exist" do
      let(:params) do
        {
          user_id: SecureRandom.uuid,
          space_id: space.id.to_s
        }
      end

      it "returns a failure" do
        result = show_currency_data_operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to eq("Onboarding not found")
      end
    end

    context "when space does not exist" do
      let(:params) do
        {
          user_id: user.id.to_s,
          space_id: SecureRandom.uuid
        }
      end

      it "returns a failure" do
        result = show_currency_data_operation.call(params)
        expect(result).to be_failure
        expect(result.failure).to include(space_id: "not found")
      end
    end
  end
end
