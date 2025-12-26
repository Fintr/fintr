# frozen_string_literal: true

require "rails_helper"

RSpec.describe ApplicationCable::Channel, type: :channel do
  describe "inheritance" do
    it "inherits from ActionCable::Channel::Base" do
      expect(described_class.superclass).to eq(ActionCable::Channel::Base)
    end
  end

  describe "class structure" do
    it "is defined in the ApplicationCable module" do
      expect(described_class.name).to eq("ApplicationCable::Channel")
    end

    it "is a subclass of ActionCable::Channel::Base" do
      expect(described_class < ActionCable::Channel::Base).to be true
    end
  end
end

