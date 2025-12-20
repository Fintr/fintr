# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Queries::ShowImportReport, type: :query do
  include Dry::Monads[:result]

  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:import) do
    create(
      :import,
      user: user,
      space: space,
      import_location: "onboarding",
      status: "completed",
      total_rows_read: 10,
      total_rows_inserted: 7,
      total_rows_failed: 3,
      import_errors: [
        { row: 2, error: "Invalid date format" },
        { row: 5, error: "Missing amount" },
        { row: 8, error: "Category not found" }
      ]
    )
  end

  let!(:successful_record1) do
    create(
      :import_record,
      :success,
      import: import,
      record_id: SecureRandom.uuid,
      record_type: "Transactions::Transaction",
      row_number: 1
    )
  end

  let!(:successful_record2) do
    create(
      :import_record,
      :success,
      import: import,
      record_id: SecureRandom.uuid,
      record_type: "Transactions::Transaction",
      row_number: 3
    )
  end

  let!(:failed_record1) do
    create(
      :import_record,
      :failed,
      import: import,
      row_number: 2
    )
  end

  let!(:failed_record2) do
    create(
      :import_record,
      :failed,
      import: import,
      row_number: 5
    )
  end

  let!(:edited_record) do
    create(
      :import_record,
      :edited,
      import: import,
      row_number: 8
    )
  end

  describe "#call" do
    context "with valid import_id" do
      subject(:call_query) { described_class.new(import_id: import.id.to_s).call }

      it { is_expected.to be_success }

      it "returns the import in the result" do
        result_data = call_query.value!
        expect(result_data[:import]).to eq(import)
      end

      it "returns correct statistics" do
        result_data = call_query.value!
        statistics = result_data[:statistics]

        expect(statistics[:total_rows_read]).to eq(10)
        expect(statistics[:total_rows_inserted]).to eq(7)
        expect(statistics[:total_rows_failed]).to eq(3)
      end

      it "returns import errors" do
        result_data = call_query.value!
        errors = result_data[:errors]

        expect(errors).to be_an(Array)
        expect(errors.length).to eq(3)
        expect(errors).to include(
          { "row" => 2, "error" => "Invalid date format" },
          { "row" => 5, "error" => "Missing amount" },
          { "row" => 8, "error" => "Category not found" }
        )
      end

      it "returns correct successful_records count" do
        result_data = call_query.value!
        expect(result_data[:successful_records]).to eq(2)
      end

      it "returns correct failed_records count" do
        result_data = call_query.value!
        # failed_records includes both failed and edited records
        expect(result_data[:failed_records]).to eq(3)
      end

      it "returns all expected keys in the result" do
        result_data = call_query.value!

        expect(result_data).to have_key(:import)
        expect(result_data).to have_key(:statistics)
        expect(result_data).to have_key(:errors)
        expect(result_data).to have_key(:successful_records)
        expect(result_data).to have_key(:failed_records)
      end
    end

    context "when import has no records" do
      subject(:call_query) { described_class.new(import_id: empty_import.id.to_s).call }

      let(:empty_import) do
        create(
          :import,
          user: user,
          space: space,
          import_location: "settings",
          status: "pending",
          total_rows_read: 0,
          total_rows_inserted: 0,
          total_rows_failed: 0,
          import_errors: []
        )
      end


      it { is_expected.to be_success }

      it "returns zero counts for all statistics" do
        result_data = call_query.value!

        expect(result_data[:statistics][:total_rows_read]).to eq(0)
        expect(result_data[:statistics][:total_rows_inserted]).to eq(0)
        expect(result_data[:statistics][:total_rows_failed]).to eq(0)
      end

      it "returns empty errors array" do
        result_data = call_query.value!
        expect(result_data[:errors]).to eq([])
      end

      it "returns zero for successful_records" do
        result_data = call_query.value!
        expect(result_data[:successful_records]).to eq(0)
      end

      it "returns zero for failed_records" do
        result_data = call_query.value!
        expect(result_data[:failed_records]).to eq(0)
      end
    end

    context "when import does not exist" do
      subject(:call_query) { described_class.new(import_id: SecureRandom.uuid).call }

      it { is_expected.to be_failure }

      it "returns an error message" do
        expect(call_query.failure[:error]).to eq("Import not found")
      end
    end

    context "when import_id is nil" do
      subject(:call_query) { described_class.new(import_id: nil).call }

      it { is_expected.to be_failure }

      it "returns an error message" do
        expect(call_query.failure[:error]).to eq("Import not found")
      end
    end

    context "when import has only successful records" do
      subject(:call_query) { described_class.new(import_id: successful_import.id.to_s).call }

      let(:successful_import) do
        create(
          :import,
          user: user,
          space: space,
          import_location: "onboarding",
          status: "completed",
          total_rows_read: 5,
          total_rows_inserted: 5,
          total_rows_failed: 0,
          import_errors: []
        )
      end

      let!(:successful_records) do
        5.times.map do |i|
          create(
            :import_record,
            :success,
            import: successful_import,
            record_id: SecureRandom.uuid,
            record_type: "Transactions::Transaction",
            row_number: i + 1
          )
        end
      end


      it { is_expected.to be_success }

      it "returns correct successful_records count" do
        result_data = call_query.value!
        expect(result_data[:successful_records]).to eq(5)
      end

      it "returns zero for failed_records" do
        result_data = call_query.value!
        expect(result_data[:failed_records]).to eq(0)
      end
    end

    context "when import has only failed records" do
      subject(:call_query) { described_class.new(import_id: failed_import.id.to_s).call }

      let(:failed_import) do
        create(
          :import,
          user: user,
          space: space,
          import_location: "settings",
          status: "failed",
          total_rows_read: 3,
          total_rows_inserted: 0,
          total_rows_failed: 3,
          import_errors: [
            { row: 1, error: "Error 1" },
            { row: 2, error: "Error 2" },
            { row: 3, error: "Error 3" }
          ]
        )
      end

      let!(:failed_records) do
        3.times.map do |i|
          create(
            :import_record,
            :failed,
            import: failed_import,
            row_number: i + 1
          )
        end
      end


      it { is_expected.to be_success }

      it "returns zero for successful_records" do
        result_data = call_query.value!
        expect(result_data[:successful_records]).to eq(0)
      end

      it "returns correct failed_records count" do
        result_data = call_query.value!
        expect(result_data[:failed_records]).to eq(3)
      end
    end

    context "when import has edited records" do
      subject(:call_query) { described_class.new(import_id: edited_import.id.to_s).call }

      let(:edited_import) do
        create(
          :import,
          user: user,
          space: space,
          import_location: "onboarding",
          status: "completed",
          total_rows_read: 4,
          total_rows_inserted: 2,
          total_rows_failed: 2,
          import_errors: []
        )
      end

      let!(:successful_record) do
        create(
          :import_record,
          :success,
          import: edited_import,
          record_id: SecureRandom.uuid,
          record_type: "Transactions::Transaction",
          row_number: 1
        )
      end

      let!(:edited_records) do
        2.times.map do |i|
          create(
            :import_record,
            :edited,
            import: edited_import,
            row_number: i + 2
          )
        end
      end


      it { is_expected.to be_success }

      it "includes edited records in failed_records count" do
        result_data = call_query.value!
        # failed_records scope includes both failed and edited records
        expect(result_data[:failed_records]).to eq(2)
      end

      it "returns correct successful_records count" do
        result_data = call_query.value!
        expect(result_data[:successful_records]).to eq(1)
      end
    end
  end
end
