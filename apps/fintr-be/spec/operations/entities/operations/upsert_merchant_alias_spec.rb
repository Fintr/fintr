# frozen_string_literal: true

require "rails_helper"

RSpec.describe Entities::Operations::UpsertMerchantAlias do
  subject(:operation) { described_class.new }

  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:entity) { create(:entity, space:, entity_type: "transaction", full_name: "Dairy Queen") }

  it "creates a merchant alias mapping" do
    result = operation.call(
      space_id: space.id.to_s,
      scanned_name: "CORPORATION A",
      entity_id: entity.id.to_s,
    )

    expect(result).to be_success
    alias_record = Entities::MerchantAlias.find_by(space:, scanned_name: "corporation a")
    expect(alias_record.entity).to eq(entity)
  end

  it "updates an existing alias to a new entity" do
    other_entity = create(:entity, space:, entity_type: "transaction", full_name: "Jollibee")
    create(:merchant_alias, space:, entity:, scanned_name: "corporation a")

    result = operation.call(
      space_id: space.id.to_s,
      scanned_name: "CORPORATION A",
      entity_id: other_entity.id.to_s,
    )

    expect(result).to be_success
    expect(
      Entities::MerchantAlias.find_by(space:, scanned_name: "corporation a").entity,
    ).to eq(other_entity)
  end
end
