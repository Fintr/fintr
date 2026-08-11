# frozen_string_literal: true

require "rails_helper"

RSpec.describe Entities::Operations::DeleteMerchantAlias do
  subject(:operation) { described_class.new }

  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:entity) { create(:entity, space:, entity_type: "transaction", full_name: "Dairy Queen") }
  let!(:merchant_alias) do
    create(:merchant_alias, space:, entity:, scanned_name: "corporation a", label: "CORPORATION A")
  end

  it "deletes the identifier" do
    result = operation.call(
      space_id: space.id.to_s,
      entity_id: entity.id.to_s,
      id: merchant_alias.id.to_s,
    )

    expect(result).to be_success
    expect(Entities::MerchantAlias.find_by(id: merchant_alias.id)).to be_nil
  end

  it "returns not found when identifier does not belong to the entity" do
    other_entity = create(:entity, space:, entity_type: "transaction", full_name: "Jollibee")

    result = operation.call(
      space_id: space.id.to_s,
      entity_id: other_entity.id.to_s,
      id: merchant_alias.id.to_s,
    )

    expect(result).to be_failure
    expect(result.failure).to eq(id: "not found")
  end
end
