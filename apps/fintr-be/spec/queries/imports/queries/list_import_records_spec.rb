# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Queries::ListImportRecords, type: :query do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:import) { create(:import, user: user, space: space) }
  let(:other_import) { create(:import, user: user, space: space) }

  let!(:import_record_1) do
    create(
      :import_record,
      import: import,
      row_number: 1,
      status: "pending"
    )
  end
  let!(:import_record_2) do
    create(
      :import_record,
      import: import,
      row_number: 2,
      status: "success"
    )
  end
  let!(:import_record_3) do
    create(
      :import_record,
      import: import,
      row_number: 3,
      status: "failed"
    )
  end
  let!(:import_record_4) do
    create(
      :import_record,
      import: import,
      row_number: 4,
      status: "success"
    )
  end
  let!(:import_record_5) do
    create(
      :import_record,
      import: import,
      row_number: 5,
      status: "edited"
    )
  end
  let!(:other_import_record) do
    create(
      :import_record,
      import: other_import,
      row_number: 1,
      status: "pending"
    )
  end

  describe "#call" do
    context "when import_id is missing" do
      subject(:query_result) { described_class.new(import_id: nil).call }

      it "returns a failure" do
        expect(query_result).to be_failure
      end

      it "returns an error message" do
        expect(query_result.failure[:error]).to eq("import_id is required")
      end
    end

    context "when import does not exist" do
      subject(:query_result) { described_class.new(import_id: "non-existent-id").call }

      it "returns a success" do
        expect(query_result).to be_success
      end

      it "returns an empty relation" do
        records = query_result.value!
        expect(records).to be_empty
        expect(records.count).to eq(0)
      end
    end

    context "when import exists" do
      context "without status filter" do
        subject(:query_result) { described_class.new(import_id: import.id.to_s, page: 1).call }

        it "returns a success" do
          expect(query_result).to be_success
        end

        it "returns all import records for the specified import" do
          records = query_result.value!
          record_ids = records.map(&:id)

          expect(record_ids).to include(import_record_1.id, import_record_2.id, import_record_3.id, import_record_4.id, import_record_5.id)
          expect(record_ids).not_to include(other_import_record.id)
        end

        it "orders records by row_number ascending" do
          records = query_result.value!
          row_numbers = records.map(&:row_number)

          expect(row_numbers).to eq([1, 2, 3, 4, 5])
        end

        it "applies pagination" do
          records = query_result.value!

          expect(records).to respond_to(:current_page)
          expect(records).to respond_to(:total_pages)
          expect(records).to respond_to(:total_count)
        end
      end

      context "with status filter" do
        context "when filtering by success status" do
          subject(:query_result) { described_class.new(import_id: import.id.to_s, status: "success", page: 1).call }

          it "returns a success" do
            expect(query_result).to be_success
          end

          it "returns only records with success status" do
            records = query_result.value!
            record_ids = records.map(&:id)

            expect(record_ids).to include(import_record_2.id, import_record_4.id)
            expect(record_ids).not_to include(import_record_1.id, import_record_3.id)
          end

          it "orders records by row_number ascending" do
            records = query_result.value!
            row_numbers = records.map(&:row_number)

            expect(row_numbers).to eq([2, 4])
          end
        end

        context "when filtering by failed status" do
          subject(:query_result) { described_class.new(import_id: import.id.to_s, status: "failed", page: 1).call }

          it "returns a success" do
            expect(query_result).to be_success
          end

          it "returns records with both failed and edited statuses" do
            records = query_result.value!
            record_ids = records.map(&:id)

            expect(record_ids).to include(import_record_3.id, import_record_5.id)
            expect(record_ids).not_to include(import_record_1.id, import_record_2.id, import_record_4.id)
          end

          it "orders records by row_number ascending" do
            records = query_result.value!
            row_numbers = records.map(&:row_number)

            expect(row_numbers).to eq([3, 5])
          end
        end

        context "when filtering by edited status" do
          subject(:query_result) { described_class.new(import_id: import.id.to_s, status: "edited", page: 1).call }

          it "returns a success" do
            expect(query_result).to be_success
          end

          it "returns only records with edited status" do
            records = query_result.value!
            record_ids = records.map(&:id)

            expect(record_ids).to include(import_record_5.id)
            expect(record_ids).not_to include(import_record_1.id, import_record_2.id, import_record_3.id, import_record_4.id)
          end
        end

        context "when filtering by pending status" do
          subject(:query_result) { described_class.new(import_id: import.id.to_s, status: "pending", page: 1).call }

          it "returns a success" do
            expect(query_result).to be_success
          end

          it "returns only records with pending status" do
            records = query_result.value!
            record_ids = records.map(&:id)

            expect(record_ids).to include(import_record_1.id)
            expect(record_ids).not_to include(import_record_2.id, import_record_3.id, import_record_4.id, import_record_5.id)
          end
        end
      end

      context "with pagination" do
        context "when page is 1" do
          subject(:query_result) { described_class.new(import_id: import.id.to_s, page: 1, per_page: 2).call }

          it "returns the first page of records" do
            records = query_result.value!

            expect(records.count).to eq(2)
            expect(records.current_page).to eq(1)
          end
        end

        context "when page is 2" do
          subject(:query_result) { described_class.new(import_id: import.id.to_s, page: 2, per_page: 2).call }

          it "returns the second page of records" do
            records = query_result.value!

            expect(records.count).to eq(2)
            expect(records.current_page).to eq(2)
          end
        end
      end
    end
  end
end
