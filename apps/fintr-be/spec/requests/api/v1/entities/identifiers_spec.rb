# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Entities::Identifiers", type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:entity) { create(:entity, space:, entity_type: "transaction", full_name: "Dairy Queen") }

  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers].merge({ "Accept" => "application/json" }) }

  describe "POST /api/v1/entities/:entity_id/identifiers" do
    it "creates an identifier" do
      post api_v1_entity_identifiers_path(entity),
           params: { space_code: space.code, label: "CORPORATION A" },
           headers: headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json.dig("data", "label")).to eq("CORPORATION A")
      expect(Entities::MerchantAlias.find_by(space:, scanned_name: "corporation a")).to be_present
    end

    it "returns validation errors for blank labels" do
      post api_v1_entity_identifiers_path(entity),
           params: { space_code: space.code, label: "   " },
           headers: headers

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "DELETE /api/v1/entities/:entity_id/identifiers/:id" do
    let!(:merchant_alias) do
      create(:merchant_alias, space:, entity:, scanned_name: "corporation a", label: "CORPORATION A")
    end

    it "removes the identifier" do
      delete api_v1_entity_identifier_path(entity, merchant_alias),
             params: { space_code: space.code },
             headers: headers

      expect(response).to have_http_status(:ok)
      expect(Entities::MerchantAlias.find_by(id: merchant_alias.id)).to be_nil
    end

    it "returns not found for identifiers on another entity" do
      other_entity = create(:entity, space:, entity_type: "transaction", full_name: "Jollibee")

      delete api_v1_entity_identifier_path(other_entity, merchant_alias),
             params: { space_code: space.code },
             headers: headers

      expect(response).to have_http_status(:not_found)
      expect(Entities::MerchantAlias.find_by(id: merchant_alias.id)).to be_present
    end
  end
end
