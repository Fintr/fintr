# frozen_string_literal: true

require "rails_helper"

RSpec.describe Entities::Operations::GenerateEntityPhoto do
  subject(:operation) { described_class.new }

  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:entity) { create(:entity, space:, entity_type: "transaction", full_name: "Jollibee") }
  let!(:subscription_plan) { create(:subscription_plan, slug: "premium-#{SecureRandom.hex(4)}") }
  let(:image_bytes) { File.binread(Rails.root.join("spec/fixtures/files/test.jpg")) }

  before do
    allow(Entities::MerchantImageFinder).to receive(:find).and_return(
      {
        bytes: image_bytes,
        content_type: "image/jpeg",
        filename: "merchant-photo.jpg",
      },
    )
  end

  it "attaches a searched image without requiring a paid subscription" do
    result = operation.call(space_id: space.id.to_s, id: entity.id.to_s)

    expect(result).to be_success
    expect(result.value![:photo_source]).to eq("search")
    expect(entity.reload.photo).to be_attached
  end

  context "when no image is found online" do
    let(:b64_png) { Base64.strict_encode64(image_bytes) }

    before do
      allow(Entities::MerchantImageFinder).to receive(:find).and_return(nil)
      create(
        :space_subscription,
        space:,
        subscription_plan:,
        status: :active,
        subscription_type: :paid,
      )
      allow(Ai::Llm::ImageClient).to receive(:generate).and_return(b64_png)
    end

    it "generates an image with AI" do
      result = operation.call(space_id: space.id.to_s, id: entity.id.to_s)

      expect(result).to be_success
      expect(result.value![:photo_source]).to eq("generated")
      expect(Ai::Llm::ImageClient).to have_received(:generate)
      expect(entity.reload.photo).to be_attached
    end

    it "uses a custom prompt for AI generation" do
      operation.call(
        space_id: space.id.to_s,
        id: entity.id.to_s,
        prompt: "Red and yellow fast food chicken logo",
      )

      expect(Ai::Llm::ImageClient).to have_received(:generate).with(
        prompt: include("Red and yellow fast food chicken logo"),
      )
    end
  end

  context "when a custom prompt is provided" do
    before do
      allow(Ai::Llm::ImageClient).to receive(:generate)
    end

    it "still searches the web before generating" do
      result = operation.call(
        space_id: space.id.to_s,
        id: entity.id.to_s,
        prompt: "Red and yellow fast food chicken logo",
      )

      expect(Entities::MerchantImageFinder).to have_received(:find).with(
        merchant_name: "Jollibee",
        search_hints: ["Red and yellow fast food chicken logo"],
      )
      expect(result).to be_success
      expect(result.value![:photo_source]).to eq("search")
      expect(Ai::Llm::ImageClient).not_to have_received(:generate)
    end
  end

  context "when image_url is provided" do
    before do
      allow(Entities::MerchantImageFinder).to receive(:download_image).and_return(
        {
          bytes: image_bytes,
          content_type: "image/jpeg",
          filename: "merchant-photo.jpg",
        },
      )
    end

    it "attaches the selected image" do
      result = operation.call(
        space_id: space.id.to_s,
        id: entity.id.to_s,
        image_url: "https://upload.wikimedia.org/wikipedia/en/thumb/j/jollibee.png",
      )

      expect(Entities::MerchantImageFinder).not_to have_received(:find)
      expect(result).to be_success
      expect(result.value![:photo_source]).to eq("search")
      expect(entity.reload.photo).to be_attached
    end
  end
end
