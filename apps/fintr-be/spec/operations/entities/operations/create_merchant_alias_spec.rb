# frozen_string_literal: true

require "rails_helper"

RSpec.describe Entities::Operations::CreateMerchantAlias do
  subject(:operation) { described_class.new }

  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:entity) { create(:entity, space:, entity_type: "transaction", full_name: "Dairy Queen") }

  it "creates an identifier for the merchant" do
    result = operation.call(
      space_id: space.id.to_s,
      entity_id: entity.id.to_s,
      label: "CORPORATION A",
    )

    expect(result).to be_success
    expect(result.value!.label).to eq("CORPORATION A")
    expect(result.value!.entity_id).to eq(entity.id)
  end

  it "rejects identifiers that match the merchant name" do
    result = operation.call(
      space_id: space.id.to_s,
      entity_id: entity.id.to_s,
      label: "Dairy Queen",
    )

    expect(result).to be_failure
    expect(result.failure[:label]).to eq(["cannot be the same as the merchant name"])
  end
end
