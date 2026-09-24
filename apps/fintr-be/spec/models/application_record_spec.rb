# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationRecord do
  describe "UUID primary key assignment" do
    let(:space) { create(:space) }

    context "when id is not provided" do
      it "assigns a UUID before create" do
        entity = Entities::Entity.new(
          space:,
          full_name: "Auto ID Entity",
          entity_type: "loan",
        )
        entity.save!

        expect(entity.id).to be_present
      end

      it "assigns a valid UUID format" do
        entity = Entities::Entity.create!(
          space:,
          full_name: "Valid UUID Entity",
          entity_type: "loan",
        )

        expect(ApplicationRecord.valid_uuid?(entity.id)).to be(true)
      end
    end

    context "when a client UUID is provided" do
      let(:client_id) { SecureRandom.uuid }

      it "persists the provided id" do
        entity = Entities::Entity.create!(
          id: client_id,
          space:,
          full_name: "Client ID Entity",
          entity_type: "loan",
        )

        expect(entity.id).to eq(client_id)
      end
    end

    context "when id is not a valid UUID" do
      it "rejects local-prefixed ids" do
        entity = Entities::Entity.new(
          id: "local:offline-entity",
          space:,
          full_name: "Invalid ID Entity",
          entity_type: "loan",
        )

        expect(entity).not_to be_valid
      end

      it "adds an id validation error" do
        entity = Entities::Entity.new(
          id: "local:offline-entity",
          space:,
          full_name: "Invalid ID Entity",
          entity_type: "loan",
        )
        entity.valid?

        expect(entity.errors[:id]).to include("must be a valid UUID")
      end
    end
  end

  describe ".valid_uuid?" do
    it "returns true for a valid UUID" do
      expect(ApplicationRecord.valid_uuid?(SecureRandom.uuid)).to be(true)
    end

    it "returns false for a local-prefixed id" do
      expect(ApplicationRecord.valid_uuid?("local:abc")).to be(false)
    end
  end
end
