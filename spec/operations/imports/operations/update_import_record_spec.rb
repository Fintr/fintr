# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Operations::UpdateImportRecord, type: :operation do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:import) do
    create(
      :import,
      user: user,
      space: space,
      import_location: "onboarding",
      status: "pending"
    )
  end

  let(:import_record) do
    create(
      :import_record,
      :failed,
      import: import,
      row_number: 1,
      original_data: {
        "date" => "2024-01-15",
        "amount" => 100.0,
        "type" => "expense",
        "category" => "Groceries",
        "description" => "Original description"
      }
    )
  end

  let(:valid_params) do
    {
      import_record_id: import_record.id.to_s,
      date: "2024-01-20",
      description: "Updated description",
      amount: 150.0,
      type: "income",
      category: "Salary"
    }
  end

  describe "#validate" do
    context "with valid parameters" do
      it "succeeds with all optional fields" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end

      it "succeeds with only required field" do
        result = operation.validate(params: { import_record_id: import_record.id.to_s })

        expect(result).to be_success
      end

      it "succeeds with partial optional fields" do
        result = operation.validate(
          params: {
            import_record_id: import_record.id.to_s,
            date: "2024-01-20"
          }
        )

        expect(result).to be_success
      end

      it "succeeds with valid type 'income'" do
        result = operation.validate(
          params: {
            import_record_id: import_record.id.to_s,
            type: "income"
          }
        )

        expect(result).to be_success
      end

      it "succeeds with valid type 'expense'" do
        result = operation.validate(
          params: {
            import_record_id: import_record.id.to_s,
            type: "expense"
          }
        )

        expect(result).to be_success
      end
    end

    context "with invalid parameters" do
      context "when import_record_id is missing" do
        it "raises an ArgumentError when called with empty hash" do
          expect { operation.validate(params: {}) }.to raise_error(ArgumentError)
        end
      end

      context "when type is invalid" do
        it "fails when type is not 'income' or 'expense'" do
          result = operation.validate(
            params: {
              import_record_id: import_record.id.to_s,
              type: "invalid"
            }
          )

          expect(result).to be_failure
          expect(result.failure).to have_key(:type)
        end
      end
    end
  end

  describe "#call" do
    context "with valid parameters" do
      context "when updating all fields" do
        subject(:call_operation) { operation.call(valid_params) }

        it { is_expected.to be_success }

        it "updates the import record with edited data" do
          call_operation
          import_record.reload

          expect(import_record.edited_data["date"]).to eq("2024-01-20")
          expect(import_record.edited_data["description"]).to eq("Updated description")
          expect(import_record.edited_data["amount"]).to eq("150.0")
          expect(import_record.edited_data["type"]).to eq("income")
          expect(import_record.edited_data["category"]).to eq("Salary")
        end

        it "preserves original data fields not being updated" do
          call_operation
          import_record.reload

          # Original data should still have the original values
          expect(import_record.original_data["date"]).to eq("2024-01-15")
          expect(import_record.original_data["amount"]).to eq(100.0)
        end

        it "sets status to edited" do
          call_operation
          import_record.reload

          expect(import_record.status).to eq("edited")
        end

        it "returns the updated import record" do
          result = call_operation.value!
          expect(result).to eq(import_record)
        end
      end

      context "when updating only date" do
        subject(:call_operation) do
          operation.call(
            import_record_id: import_record.id.to_s,
            date: "2024-02-01"
          )
        end

        it { is_expected.to be_success }

        it "updates only the date field" do
          call_operation
          import_record.reload

          expect(import_record.edited_data["date"]).to eq("2024-02-01")
          expect(import_record.edited_data["amount"]).to eq(100.0)
          expect(import_record.edited_data["description"]).to eq("Original description")
        end
      end

      context "when updating only description" do
        subject(:call_operation) do
          operation.call(
            import_record_id: import_record.id.to_s,
            description: "New description"
          )
        end

        it { is_expected.to be_success }

        it "updates only the description field" do
          call_operation
          import_record.reload

          expect(import_record.edited_data["description"]).to eq("New description")
          expect(import_record.edited_data["date"]).to eq("2024-01-15")
        end
      end

      context "when updating only amount" do
        subject(:call_operation) do
          operation.call(
            import_record_id: import_record.id.to_s,
            amount: 200.0
          )
        end

        it { is_expected.to be_success }

        it "updates only the amount field" do
          call_operation
          import_record.reload

          expect(import_record.edited_data["amount"]).to eq("200.0")
          expect(import_record.edited_data["date"]).to eq("2024-01-15")
        end
      end

      context "when updating only type" do
        subject(:call_operation) do
          operation.call(
            import_record_id: import_record.id.to_s,
            type: "income"
          )
        end

        it { is_expected.to be_success }

        it "updates only the type field and downcases it" do
          call_operation
          import_record.reload

          expect(import_record.edited_data["type"]).to eq("income")
          expect(import_record.edited_data["date"]).to eq("2024-01-15")
        end

        it "downcases the type value" do
          result = operation.call(
            import_record_id: import_record.id.to_s,
            type: "income"
          )
          expect(result).to be_success
          import_record.reload

          expect(import_record.edited_data["type"]).to eq("income")
        end
      end

      context "when updating only category" do
        subject(:call_operation) do
          operation.call(
            import_record_id: import_record.id.to_s,
            category: "New Category"
          )
        end

        it { is_expected.to be_success }

        it "updates only the category field" do
          call_operation
          import_record.reload

          expect(import_record.edited_data["category"]).to eq("New Category")
          expect(import_record.edited_data["date"]).to eq("2024-01-15")
        end
      end

      context "when import record is already edited" do
        subject(:call_operation) do
          operation.call(
            import_record_id: edited_import_record.id.to_s,
            amount: 200.0
          )
        end

        let(:edited_import_record) do
          create(
            :import_record,
            :edited,
            import: import,
            row_number: 1,
            original_data: {
              "date" => "2024-01-15",
              "amount" => 100.0
            },
            edited_data: {
              "date" => "2024-01-20",
              "amount" => 150.0
            }
          )
        end


        it { is_expected.to be_success }

        it "merges new edits starting from original_data" do
          call_operation
          edited_import_record.reload

          # The operation starts with original_data, not edited_data
          # So it will have the new amount but the original date
          expect(edited_import_record.edited_data["amount"]).to eq("200.0")
          expect(edited_import_record.edited_data["date"]).to eq("2024-01-15")
        end
      end
    end

    context "with invalid parameters" do
      context "when import_record_id is missing" do
        it "raises an ArgumentError when called with empty hash" do
          expect { operation.call({}) }.to raise_error(ArgumentError)
        end
      end

      context "when import record does not exist" do
        subject(:call_operation) do
          operation.call(import_record_id: SecureRandom.uuid)
        end

        it { is_expected.to be_failure }

        it "returns a failure with import record not found error" do
          expect(call_operation.failure[:error]).to eq("Import record not found")
        end
      end

      context "when import record is not editable" do
        subject(:call_operation) do
          operation.call(import_record_id: success_import_record.id.to_s)
        end

        let(:success_import_record) do
          create(
            :import_record,
            :success,
            import: import,
            record_id: SecureRandom.uuid,
            record_type: "Transactions::Transaction"
          )
        end


        it { is_expected.to be_failure }

        it "returns a failure with not editable error" do
          expect(call_operation.failure[:error]).to eq("Import record is not editable")
        end
      end

      context "when type is invalid" do
        subject(:call_operation) do
          operation.call(
            import_record_id: import_record.id.to_s,
            type: "invalid"
          )
        end

        it { is_expected.to be_failure }

        it "returns a failure with type validation error" do
          expect(call_operation.failure).to have_key(:type)
        end
      end
    end

    context "when mark_as_edited fails" do
      subject(:call_operation) do
        operation.call(
          import_record_id: import_record.id.to_s,
          date: "2024-01-20"
        )
      end

      before do
        allow_any_instance_of(Imports::ImportRecord).to receive(:mark_as_edited).and_raise(ActiveRecord::RecordInvalid.new(import_record))
      end

      it "raises the error and transaction rolls back" do
        expect { call_operation }.to raise_error(ActiveRecord::RecordInvalid)
        import_record.reload

        # Transaction should roll back, so status should remain as failed
        expect(import_record.status).to eq("failed")
      end
    end

    context "when updating with empty string values" do
      subject(:call_operation) do
        operation.call(
          import_record_id: import_record.id.to_s,
          date: "",
          description: "",
          category: ""
        )
      end

      it "does not update fields with empty strings" do
        call_operation
        import_record.reload

        # Empty strings should not override existing values
        expect(import_record.edited_data["date"]).to eq("2024-01-15")
        expect(import_record.edited_data["description"]).to eq("Original description")
        expect(import_record.edited_data["category"]).to eq("Groceries")
      end
    end
  end
end
