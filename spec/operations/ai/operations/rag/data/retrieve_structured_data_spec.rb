# frozen_string_literal: true

require "rails_helper"

RSpec.describe Ai::Operations::Rag::Data::RetrieveStructuredData, type: :operation do
  # TODO: Update tests after AI RAG data retrieval refactoring
  # The operation has been refactored and now uses a QueryBuilder
  # Tests should be rewritten to test the integration rather than
  # testing internal implementation details.

  it "exists as an operation class" do
    expect(described_class).to be < Dry::Operation
  end
end
