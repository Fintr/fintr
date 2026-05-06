# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::ExchangeRates", type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }

  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers].merge("Accept" => "application/json") }

  describe "GET /api/v1/exchange_rates/current" do
    let(:mock_operation) { instance_double(ExchangeRates::Operations::FetchRate) }
    let(:rate_data) do
      {
        rate: 0.018,
        from_currency: "PHP",
        to_currency: "USD",
        timestamp: Time.current
      }
    end

    context "when the operation succeeds" do
      before do
        allow(ExchangeRates::Operations::FetchRate).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(Dry::Monads::Success(rate_data))
        get current_api_v1_exchange_rates_path,
            params: { from_currency: "PHP", to_currency: "USD", space_code: space.code },
            headers: headers
      end

      it "returns ok" do
        expect(response).to have_http_status(:ok)
      end

      it "returns rate data" do
        json = JSON.parse(response.body)
        expect(json["success"]).to be(true)
        expect(json["data"]["rate"]).to eq(0.018)
        expect(json["data"]["fromCurrency"]).to eq("PHP")
        expect(json["data"]["toCurrency"]).to eq("USD")
        expect(json["data"]["source"]).to eq("auto")
      end
    end

    context "when the operation fails" do
      before do
        allow(ExchangeRates::Operations::FetchRate).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(Dry::Monads::Failure("Rate not found"))
        get current_api_v1_exchange_rates_path,
            params: { from_currency: "PHP", to_currency: "USD", space_code: space.code },
            headers: headers
      end

      it "returns unprocessable_entity" do
        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end

  describe "GET /api/v1/exchange_rates/recent" do
    let(:mock_operation) { instance_double(ExchangeRates::Operations::GetRecentRates) }
    let(:recent_rates) { [{ rate: 0.018, timestamp: 1.hour.ago }, { rate: 0.017, timestamp: 2.hours.ago }] }

    context "when the operation succeeds" do
      before do
        allow(ExchangeRates::Operations::GetRecentRates).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(Dry::Monads::Success(recent_rates))
        get recent_api_v1_exchange_rates_path,
            params: { from_currency: "PHP", to_currency: "USD", space_code: space.code },
            headers: headers
      end

      it "returns ok" do
        expect(response).to have_http_status(:ok)
      end

      it "returns recent rates" do
        json = JSON.parse(response.body)
        expect(json["data"]["rates"].length).to eq(2)
        expect(json["data"]["source"]).to eq("last_prices")
      end
    end

    context "when the operation fails" do
      before do
        allow(ExchangeRates::Operations::GetRecentRates).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(Dry::Monads::Failure("error"))
        get recent_api_v1_exchange_rates_path,
            params: { from_currency: "PHP", to_currency: "USD", space_code: space.code },
            headers: headers
      end

      it "returns unprocessable_entity" do
        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end
end
