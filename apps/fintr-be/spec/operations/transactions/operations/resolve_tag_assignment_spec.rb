# frozen_string_literal: true

require "rails_helper"

RSpec.describe Transactions::Operations::ResolveTagAssignment do
  let(:operation) { described_class.new }
  let(:space) { create(:personal_space) }
  let!(:tag) { create(:transaction_tag, space:, name: "Japan 2026") }

  it "returns tags that belong to the space" do
    result = operation.call(space_id: space.id, tag_ids: [tag.id])

    expect(result).to be_success
    expect(result.value!).to eq([tag])
  end

  it "returns empty array when tag_ids is empty" do
    result = operation.call(space_id: space.id, tag_ids: [])

    expect(result).to be_success
    expect(result.value!).to eq([])
  end

  it "fails when a tag id is not in the space" do
    other_space = create(:personal_space)
    other_tag = create(:transaction_tag, space: other_space)

    result = operation.call(space_id: space.id, tag_ids: [other_tag.id])

    expect(result).to be_failure
    expect(result.failure).to include(tag_ids: "not found")
  end
end
