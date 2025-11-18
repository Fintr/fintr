# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Serializers::ImportRecordSerializer do
  subject(:serialized_hash) { described_class.render_as_hash(import_record) }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:import) { create(:import, user: user, space: space) }

  let(:import_record) do
    create(
      :import_record,
      import: import,
      row_number: 1,
      original_data: { "date" => "2024-01-15", "amount" => 100.0 },
      edited_data: {},
      status: "pending",
      record_type: nil,
      record_id: nil,
      import_errors: []
    )
  end

  describe "basic fields" do
    it "includes the id" do
      expect(serialized_hash[:id]).to eq(import_record.id)
    end

    it "includes the row_number" do
      expect(serialized_hash[:row_number]).to eq(1)
    end

    it "includes the original_data" do
      expect(serialized_hash[:original_data]).to eq({ "date" => "2024-01-15", "amount" => 100.0 })
    end

    it "includes the edited_data" do
      expect(serialized_hash[:edited_data]).to eq({})
    end

    it "includes the status" do
      expect(serialized_hash[:status]).to eq("pending")
    end

    it "includes the record_type" do
      expect(serialized_hash[:record_type]).to be_nil
    end

    it "includes the record_id" do
      expect(serialized_hash[:record_id]).to be_nil
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
        let(:import_record) do
          create(
            :import_record,
            import: import,
            import_errors: ["Error 1", "Error 2"]
          )
        end

        it "returns import_errors as errors" do
          expect(serialized_hash[:errors]).to eq(["Error 1", "Error 2"])
        end
      end

      context "when import_errors is nil" do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            import_errors: nil
          )
        end

        it "returns an empty array" do
          expect(serialized_hash[:errors]).to eq([])
        end
      end

      context "when import_errors is an empty array" do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            import_errors: []
          )
        end

        it "returns an empty array" do
          expect(serialized_hash[:errors]).to eq([])
        end
      end
    end

    describe ":is_editable field" do
      context "when record is editable (failed status)" do
        let(:import_record) do
          create(
            :import_record,
            :failed,
            import: import
          )
        end

        it "returns true" do
          expect(serialized_hash[:is_editable]).to be(true)
        end
      end

      context "when record is editable (edited status)" do
        let(:import_record) do
          create(
            :import_record,
            :edited,
            import: import
          )
        end

        it "returns true" do
          expect(serialized_hash[:is_editable]).to be(true)
        end
      end

      context "when record is not editable (success status)" do
        let(:import_record) do
          create(
            :import_record,
            :success,
            import: import
          )
        end

        it "returns false" do
          expect(serialized_hash[:is_editable]).to be(false)
        end
      end

      context "when record is not editable (pending status)" do
        let(:import_record) do
          create(
            :import_record,
            :pending,
            import: import
          )
        end

        it "returns false" do
          expect(serialized_hash[:is_editable]).to be(false)
        end
      end
    end

    describe ":import_data field" do
      context "when edited_data is present" do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            original_data: { "date" => "2024-01-15", "amount" => 100.0 },
            edited_data: { "date" => "2024-01-20", "amount" => 150.0 }
          )
        end

        it "returns edited_data" do
          expect(serialized_hash[:import_data]).to eq({ "date" => "2024-01-20", "amount" => 150.0 })
        end
      end

      context "when edited_data is not present" do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            original_data: { "date" => "2024-01-15", "amount" => 100.0 },
            edited_data: {}
          )
        end

        it "returns original_data" do
          expect(serialized_hash[:import_data]).to eq({ "date" => "2024-01-15", "amount" => 100.0 })
        end
      end

      context "when edited_data is nil" do
        let(:import_record) do
          create(
            :import_record,
            import: import,
            original_data: { "date" => "2024-01-15", "amount" => 100.0 },
            edited_data: nil
          )
        end

        it "returns original_data" do
          expect(serialized_hash[:import_data]).to eq({ "date" => "2024-01-15", "amount" => 100.0 })
        end
      end
    end
  end

  describe "serialization completeness" do
    it "serializes all expected fields" do
      expected_keys = [
        :id,
        :row_number,
        :original_data,
        :edited_data,
        :status,
        :record_type,
        :record_id,
        :created_at,
        :updated_at,
        :errors,
        :is_editable,
        :import_data
      ]
      expect(serialized_hash.keys).to match_array(expected_keys)
    end
  end

  context "when record has record_type and record_id" do
    let(:transaction) { create(:expense_transaction, space: space, user: user) }
    let(:import_record) do
      create(
        :import_record,
        :success,
        import: import,
        record_type: "Transactions::Expense",
        record_id: transaction.id
      )
    end

    it "includes the record_type" do
      expect(serialized_hash[:record_type]).to eq("Transactions::Expense")
    end

    it "includes the record_id" do
      expect(serialized_hash[:record_id]).to eq(transaction.id)
    end
  end
end
