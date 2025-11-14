# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Serializers::ImportSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(import) }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:import) do
    Imports::Import.create!(
      user: user,
      space: space,
      import_location: "settings",
      status: "pending",
      total_rows_read: 10,
      total_rows_inserted: 8,
      total_rows_failed: 2,
      metadata: { "source" => "api" },
      processed_at: nil,
      import_errors: []
    )
  end

  describe "basic fields" do
    it "includes the id" do
      expect(serialized_hash[:id]).to eq(import.id)
    end

    it "includes the status" do
      expect(serialized_hash[:status]).to eq("pending")
    end

    it "includes the import_location" do
      expect(serialized_hash[:import_location]).to eq("settings")
    end

    it "includes the total_rows_read" do
      expect(serialized_hash[:total_rows_read]).to eq(10)
    end

    it "includes the total_rows_inserted" do
      expect(serialized_hash[:total_rows_inserted]).to eq(8)
    end

    it "includes the total_rows_failed" do
      expect(serialized_hash[:total_rows_failed]).to eq(2)
    end

    it "includes the metadata" do
      expect(serialized_hash[:metadata]).to eq({ "source" => "api" })
    end

    it "includes the processed_at" do
      expect(serialized_hash[:processed_at]).to be_nil
    end

    it "includes the created_at" do
      expect(serialized_hash[:created_at]).to be_present
    end

    it "includes the updated_at" do
      expect(serialized_hash[:updated_at]).to be_present
    end
  end

  describe "computed fields" do
    describe ":errors field" do
      context "when import_errors is present" do
        let(:import) do
          Imports::Import.create!(
            user: user,
            space: space,
            import_location: "settings",
            status: "failed",
            import_errors: ["Error 1", "Error 2"]
          )
        end

        it "returns import_errors as errors" do
          expect(serialized_hash[:errors]).to eq(["Error 1", "Error 2"])
        end
      end

      context "when import_errors is nil" do
        let(:import) do
          Imports::Import.create!(
            user: user,
            space: space,
            import_location: "settings",
            status: "pending",
            import_errors: nil
          )
        end

        it "returns nil" do
          expect(serialized_hash[:errors]).to be_nil
        end
      end

      context "when import_errors is an empty array" do
        let(:import) do
          Imports::Import.create!(
            user: user,
            space: space,
            import_location: "settings",
            status: "pending",
            import_errors: []
          )
        end

        it "returns an empty array" do
          expect(serialized_hash[:errors]).to eq([])
        end
      end
    end

    describe ":successful_records_count field" do
      context "when there are successful records" do
        let(:transaction1) { create(:expense_transaction, space: space, user: user) }
        let(:transaction2) { create(:expense_transaction, space: space, user: user) }

        before do
          record1 = Imports::ImportRecord.new(import: import, row_number: 1)
          record1.record = transaction1
          record1.save!

          record2 = Imports::ImportRecord.new(import: import, row_number: 2)
          record2.record = transaction2
          record2.save!
        end

        it "returns the count of successful records" do
          expect(serialized_hash[:successful_records_count]).to eq(2)
        end
      end

      context "when there are no successful records" do
        it "returns 0" do
          expect(serialized_hash[:successful_records_count]).to eq(0)
        end
      end
    end

    describe ":failed_records_count field" do
      context "when there are failed records" do
        before do
          create(
            :import_record,
            :failed,
            import: import,
            row_number: 1
          )
          create(
            :import_record,
            :failed,
            import: import,
            row_number: 2
          )
        end

        it "returns the count of failed records" do
          expect(serialized_hash[:failed_records_count]).to eq(2)
        end
      end

      context "when there are no failed records" do
        it "returns 0" do
          expect(serialized_hash[:failed_records_count]).to eq(0)
        end
      end
    end

    describe ":can_revert field" do
      context "when import is completed and has successful records" do
        let(:transaction) { create(:expense_transaction, space: space, user: user) }

        before do
          import.update!(status: "completed")
          record = Imports::ImportRecord.new(import: import, row_number: 1)
          record.record = transaction
          record.save!
        end

        it "returns true" do
          expect(serialized_hash[:can_revert]).to be(true)
        end
      end

      context "when import is failed and has successful records" do
        let(:transaction) { create(:expense_transaction, space: space, user: user) }

        before do
          import.update!(status: "failed")
          record = Imports::ImportRecord.new(import: import, row_number: 1)
          record.record = transaction
          record.save!
        end

        it "returns true" do
          expect(serialized_hash[:can_revert]).to be(true)
        end
      end

      context "when import is completed but has no successful records" do
        before do
          import.update!(status: "completed")
        end

        it "returns false" do
          expect(serialized_hash[:can_revert]).to be(false)
        end
      end

      context "when import is pending" do
        it "returns false" do
          expect(serialized_hash[:can_revert]).to be(false)
        end
      end

      context "when import is processing" do
        before do
          import.update!(status: "processing")
        end

        it "returns false" do
          expect(serialized_hash[:can_revert]).to be(false)
        end
      end

      context "when import is reverted" do
        before do
          import.update!(status: "reverted")
        end

        it "returns false" do
          expect(serialized_hash[:can_revert]).to be(false)
        end
      end
    end
  end

  describe "serialization completeness" do
    it "serializes all expected fields" do
      expected_keys = [
        :id,
        :status,
        :import_location,
        :total_rows_read,
        :total_rows_inserted,
        :total_rows_failed,
        :metadata,
        :processed_at,
        :created_at,
        :updated_at,
        :errors,
        :successful_records_count,
        :failed_records_count,
        :can_revert
      ]
      expect(serialized_hash.keys).to match_array(expected_keys)
    end
  end

  context "when import has processed_at" do
    let(:processed_time) { Time.current }

    before do
      import.update!(processed_at: processed_time)
    end

    it "includes the processed_at timestamp" do
      expect(serialized_hash[:processed_at]).to be_within(1.second).of(processed_time)
    end
  end

  context "when import has different statuses" do
    %w[pending processing completed failed reverted].each do |status|
      context "when status is #{status}" do
        before do
          import.update!(status: status)
        end

        it "serializes the correct status" do
          expect(serialized_hash[:status]).to eq(status)
        end
      end
    end
  end

  context "when import has different import_locations" do
    %w[onboarding settings].each do |location|
      context "when import_location is #{location}" do
        let(:import) do
          Imports::Import.create!(
            user: user,
            space: space,
            import_location: location,
            status: "pending"
          )
        end

        it "serializes the correct import_location" do
          expect(serialized_hash[:import_location]).to eq(location)
        end
      end
    end
  end
end


