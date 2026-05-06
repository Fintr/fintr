# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Onboardings", type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }

  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers].merge("Accept" => "application/json") }

  describe "GET /api/v1/onboardings (show)" do
    context "when step is currency" do
      let(:mock_operation) { instance_double(Onboardings::Operations::DelegateStep) }
      let(:currency_data) { { currency: "PHP", stored_currency: nil } }

      before do
        allow(Onboardings::Operations::DelegateStep).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(Dry::Monads::Success(currency_data))
        get api_v1_onboardings_path, params: { step: "currency", space_code: space.code }, headers: headers
      end

      it "returns ok" do
        expect(response).to have_http_status(:ok)
      end

      it "returns currency data" do
        json = JSON.parse(response.body)
        expect(json["success"]).to be(true)
        expect(json["data"]["currency"]).to eq("PHP")
      end
    end

    context "when step is income" do
      let(:mock_operation) { instance_double(Onboardings::Operations::DelegateStep) }
      let(:income_data) { { income: 50_000 } }

      before do
        allow(Onboardings::Operations::DelegateStep).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(Dry::Monads::Success(income_data))
        get api_v1_onboardings_path, params: { step: "income", space_code: space.code }, headers: headers
      end

      it "returns ok" do
        expect(response).to have_http_status(:ok)
      end

      it "returns income data" do
        json = JSON.parse(response.body)
        expect(json["data"]["income"]).to eq(50_000)
      end
    end

    context "when operation fails" do
      before do
        allow(Onboardings::Operations::DelegateStep).to receive(:new).and_return(
          instance_double(Onboardings::Operations::DelegateStep, call: Dry::Monads::Failure("error"))
        )
        get api_v1_onboardings_path, params: { step: "income", space_code: space.code }, headers: headers
      end

      it "returns internal_server_error" do
        expect(response).to have_http_status(:internal_server_error)
      end
    end
  end

  describe "POST /api/v1/onboardings (create)" do
    context "when step is currency" do
      let(:mock_operation) { instance_double(Onboardings::Operations::DelegateStep) }
      let(:result_data) { { income_data: { income: nil } } }

      before do
        allow(Onboardings::Operations::DelegateStep).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(Dry::Monads::Success(result_data))
        post api_v1_onboardings_path,
             params: { step: "currency", currency: "USD", space_code: space.code },
             headers: headers
      end

      it "returns ok" do
        expect(response).to have_http_status(:ok)
      end

      it "calls delegate with currency params" do
        expect(mock_operation).to have_received(:call).with(
          hash_including(step: "currency", currency: "USD")
        )
      end
    end

    context "when step is income" do
      let(:mock_operation) { instance_double(Onboardings::Operations::DelegateStep) }
      let(:result_data) { { budgets_data: [] } }

      before do
        allow(Onboardings::Operations::DelegateStep).to receive(:new).and_return(mock_operation)
        allow(mock_operation).to receive(:call).and_return(Dry::Monads::Success(result_data))
        post api_v1_onboardings_path,
             params: { step: "income", income: 30_000, space_code: space.code },
             headers: headers
      end

      it "returns ok" do
        expect(response).to have_http_status(:ok)
      end
    end

    context "when operation fails" do
      before do
        allow(Onboardings::Operations::DelegateStep).to receive(:new).and_return(
          instance_double(Onboardings::Operations::DelegateStep, call: Dry::Monads::Failure("error"))
        )
        post api_v1_onboardings_path,
             params: { step: "currency", currency: "USD", space_code: space.code },
             headers: headers
      end

      it "returns internal_server_error" do
        expect(response).to have_http_status(:internal_server_error)
      end
    end
  end
end
