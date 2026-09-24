# frozen_string_literal: true

require "rails_helper"

RSpec.describe Entities::MerchantImageFinder do
  subject(:finder) { described_class.new(merchant_name: "Jollibee") }

  let(:image_payload) do
    {
      bytes: "image-bytes",
      content_type: "image/jpeg",
      filename: "merchant-photo.jpg",
    }
  end

  let(:candidate) do
    {
      thumbnail_url: "https://upload.wikimedia.org/wikipedia/en/thumb/j/jollibee.png",
      title: "Jollibee",
      source_url: "https://en.wikipedia.org/wiki/Jollibee",
    }
  end

  it "returns downloaded image bytes from wikipedia" do
    allow(finder).to receive(:find_all).and_return([candidate])
    allow(finder).to receive(:download_image)
      .with(candidate[:thumbnail_url])
      .and_return(image_payload)

    expect(finder.find).to eq(image_payload)
  end

  it "returns nil when no merchant name is provided" do
    expect(described_class.new(merchant_name: "").find).to be_nil
  end

  it "includes search hints in lookup queries" do
    finder = described_class.new(
      merchant_name: "JOllibee",
      search_hints: ["Jollibee fried chicken restaurant"],
    )

    allow(finder).to receive(:fetch_wikipedia_candidates).and_return([])
    allow(finder).to receive(:fetch_wikipedia_candidates)
      .with("Jollibee fried chicken restaurant logo")
      .and_return([candidate])

    expect(finder.find_all).to eq([candidate])
  end

  it "deduplicates candidates across queries" do
    allow(finder).to receive(:fetch_wikipedia_candidates).and_return([candidate])

    expect(finder.find_all).to eq([candidate])
  end
end
