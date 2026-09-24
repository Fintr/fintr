# frozen_string_literal: true

require "rails_helper"

RSpec.describe Entities::Operations::SearchEntityPhotos do
  subject(:operation) { described_class.new }

  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:entity) { create(:entity, space:, entity_type: "transaction", full_name: "Jollibee") }
  let(:candidates) do
    [
      {
        thumbnail_url: "https://upload.wikimedia.org/wikipedia/en/thumb/j/jollibee.png",
        title: "Jollibee",
        source_url: "https://en.wikipedia.org/wiki/Jollibee",
      },
      {
        thumbnail_url: "https://upload.wikimedia.org/wikipedia/en/thumb/s/starbucks.png",
        title: "Starbucks",
        source_url: "https://en.wikipedia.org/wiki/Starbucks",
      },
    ]
  end

  before do
    allow(Entities::MerchantImageFinder).to receive(:find_all).and_return(candidates)
  end

  it "returns logo candidates without attaching a photo" do
    result = operation.call(space_id: space.id.to_s, id: entity.id.to_s)

    expect(result).to be_success
    expect(result.value![:candidates]).to eq(candidates)
    expect(entity.reload.photo).not_to be_attached
  end

  it "passes search hints to the image finder" do
    operation.call(
      space_id: space.id.to_s,
      id: entity.id.to_s,
      prompt: "Jollibee fried chicken",
    )

    expect(Entities::MerchantImageFinder).to have_received(:find_all).with(
      merchant_name: "Jollibee",
      search_hints: ["Jollibee fried chicken"],
    )
  end
end
