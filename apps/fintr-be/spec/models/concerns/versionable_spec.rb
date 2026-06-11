# frozen_string_literal: true

require "rails_helper"

RSpec.shared_examples "versionable" do |version_class:, record_factory:|
  let(:record) { create(record_factory) }

  describe "paper trail configuration" do
    it "derives the version class from the model name" do
      expect(described_class.paper_trail.version_class).to eq(version_class)
    end

    it "exposes versions through .versions" do
      expect(record).to respond_to(:versions)
      expect(record.versions.klass).to eq(version_class)
    end

    it "skips updated_at from version records" do
      expect(described_class.paper_trail_options[:skip]).to include("updated_at")
    end
  end

  describe "#paper_trail_cause" do
    it "reads cause from PaperTrail.request" do
      PaperTrail.request(controller_info: { cause: "test_cause", operation: "TestOp" }) do
        expect(record.paper_trail_cause).to eq("test_cause")
      end
    end
  end

  describe "#paper_trail_operation" do
    it "reads operation from PaperTrail.request" do
      PaperTrail.request(controller_info: { cause: "test_cause", operation: "TestOp" }) do
        expect(record.paper_trail_operation).to eq("TestOp")
      end
    end
  end

  describe "recording versions" do
    it "appends versions to the record association" do
      record
      version_class.delete_all

      PaperTrail.request(
        controller_info: {
          cause: "spec_versionable",
          operation: "VersionableSpec",
        }
      ) do
        if record.is_a?(Transactions::Account)
          record.update!(
            balance: record.balance + Money.from_amount(1, record.balance_currency)
          )
        else
          record.update!(description: "#{record.description} updated")
        end
      end

      expect(record.versions.count).to eq(1)
      expect(record.versions.last.cause).to eq("spec_versionable")
      expect(record.versions.last.operation).to eq("VersionableSpec")
    end
  end
end

RSpec.describe Versionable do
  describe Transactions::Account do
    it_behaves_like(
      "versionable",
      version_class: Transactions::AccountVersion,
      record_factory: :account
    )
  end

  describe Transactions::Transaction do
    it_behaves_like(
      "versionable",
      version_class: Transactions::TransactionVersion,
      record_factory: :expense_transaction
    )
  end
end
