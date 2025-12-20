# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Operations::RevertImport, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:import) { create(:import, user: user, space: space, status: "completed") }
  let(:valid_params) do
    {
      import: import
    }
  end

  describe "Contract" do
    context "when import can be reverted" do
      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      before do
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: SecureRandom.uuid,
          record_type: "Transactions::Transaction"
        )
      end

      it "succeeds with valid parameters" do
        result = operation.validate(params: valid_params)

        expect(result).to be_success
      end
    end

    context "when import cannot be reverted" do
      context "when import is pending" do
        let(:import) do
          create(
            :import,
            user: user,
            space: space,
            status: "pending"
          )
        end

        it "fails validation" do
          result = operation.validate(params: valid_params)

          expect(result).to be_failure
          expect(result.failure[:import]).to include("Import cannot be reverted")
        end
      end

      context "when import has no successful records" do
        let(:import) do
          create(
            :import,
            user: user,
            space: space,
            status: "completed"
          )
        end

        it "fails validation" do
          result = operation.validate(params: valid_params)

          expect(result).to be_failure
          expect(result.failure[:import]).to include("Import cannot be reverted")
        end
      end
    end
  end

  describe "#call" do
    context "when all steps succeed" do
      let(:account) { create(:account, space: space) }
      let(:transaction1) { create(:expense_transaction, space: space, account: account) }
      let(:transaction2) { create(:income_transaction, space: space, account: account) }
      let(:category) { create(:category, space: space) }

      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      before do
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: transaction1.id,
          record_type: "Transactions::Expense"
        )
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: transaction2.id,
          record_type: "Transactions::Income"
        )
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: category.id,
          record_type: "Transactions::Category"
        )
      end

      it "returns success with reverted counts" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!).to have_key(:message)
        expect(result.value!).to have_key(:reverted_count)
        expect(result.value!).to have_key(:deleted_categories_count)
      end

      it "deletes transaction records" do
        expect { operation.call(valid_params) }.to change(Transactions::Transaction, :count).by(-2)
      end

      it "deletes category records" do
        expect { operation.call(valid_params) }.to change(Transactions::Category, :count).by(-1)
      end

      it "deletes import records" do
        expect { operation.call(valid_params) }.to change(Imports::ImportRecord, :count).by(-3)
      end

      it "updates import status to reverted" do
        operation.call(valid_params)

        expect(import.reload.status).to eq("reverted")
      end

      it "returns correct message with counts" do
        result = operation.call(valid_params)

        expect(result.value![:message]).to include("2 transactions")
        expect(result.value![:message]).to include("1 category")
        expect(result.value![:reverted_count]).to eq(2)
        expect(result.value![:deleted_categories_count]).to eq(1)
      end
    end

    context "when category has existing transactions" do
      let(:account) { create(:account, space: space) }
      let(:category) { create(:category, space: space) }
      let(:existing_transaction) { create(:expense_transaction, space: space, category: category, account: account) }
      let(:transaction) { create(:expense_transaction, space: space, account: account) }

      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      before do
        existing_transaction
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: transaction.id,
          record_type: "Transactions::Expense"
        )
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: category.id,
          record_type: "Transactions::Category"
        )
      end

      it "does not delete category with existing transactions" do
        expect { operation.call(valid_params) }.not_to change(Transactions::Category, :count)
      end

      it "deletes the transaction record" do
        expect { operation.call(valid_params) }.to change(Transactions::Transaction, :count).by(-1)
      end

      it "returns warnings about category" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!).to have_key(:warnings)
        expect(result.value![:warnings]).to be_an(Array)
        expect(result.value![:warnings].any? { |w| w.include?("cannot be deleted") }).to be true
      end

      it "still updates import status to reverted" do
        operation.call(valid_params)

        expect(import.reload.status).to eq("reverted")
      end
    end

    context "when some records fail to destroy" do
      let(:account) { create(:account, space: space) }
      let(:transaction) { create(:expense_transaction, space: space, account: account) }

      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      before do
        import_record = create(
          :import_record,
          import: import,
          status: :success,
          record_id: transaction.id,
          record_type: "Transactions::Expense"
        )

        allow_any_instance_of(Transactions::Expense).to receive(:destroy).and_raise(StandardError.new("Destroy failed"))
      end

      it "returns success with warnings" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!).to have_key(:warnings)
        expect(result.value![:warnings]).to be_an(Array)
        expect(result.value![:warnings].any? { |w| w.include?("Failed to revert record") }).to be true
      end

      it "still updates import status to reverted" do
        operation.call(valid_params)

        expect(import.reload.status).to eq("reverted")
      end
    end

    context "when import has no successful records" do
      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      it "fails validation" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:import]).to include("Import cannot be reverted")
      end
    end

    context "when import is not completed or failed" do
      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "pending"
        )
      end

      it "fails validation" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:import]).to include("Import cannot be reverted")
      end
    end

    context "when import has only category records" do
      let(:category) { create(:category, space: space) }

      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      before do
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: category.id,
          record_type: "Transactions::Category"
        )
      end

      it "only deletes category records" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:reverted_count]).to eq(0)
        expect(result.value![:deleted_categories_count]).to eq(1)
        expect { category.reload }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when import has only transaction records" do
      let(:account) { create(:account, space: space) }
      let(:transaction) { create(:expense_transaction, space: space, account: account) }

      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      before do
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: transaction.id,
          record_type: "Transactions::Expense"
        )
      end

      it "only deletes transaction records" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value![:reverted_count]).to eq(1)
        expect(result.value![:deleted_categories_count]).to eq(0)
      end
    end
  end

  describe "private methods" do
    describe "#revert_transaction_records" do
      let(:account) { create(:account, space: space) }
      let(:transaction1) { create(:expense_transaction, space: space, account: account) }
      let(:transaction2) { create(:income_transaction, space: space, account: account) }

      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      before do
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: transaction1.id,
          record_type: "Transactions::Expense"
        )
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: transaction2.id,
          record_type: "Transactions::Income"
        )
      end

      it "reverts transaction records excluding categories" do
        result = operation.send(:revert_transaction_records, import: import)

        expect(result).to be_success
        expect(result.value![:reverted_count]).to eq(2)
        expect(result.value![:errors]).to be_an(Array)
      end

      it "excludes category records" do
        category = create(:category, space: space)
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: category.id,
          record_type: "Transactions::Category"
        )

        result = operation.send(:revert_transaction_records, import: import)

        expect(result.value![:reverted_count]).to eq(2)
      end
    end

    describe "#destroy_record" do
      let(:account) { create(:account, space: space) }
      let(:transaction) { create(:expense_transaction, space: space, account: account) }

      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      let(:import_record) do
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: transaction.id,
          record_type: "Transactions::Expense"
        )
      end

      context "when record exists" do
        it "destroys the record and import_record" do
          result = operation.send(:destroy_record, import_record: import_record)

          expect(result).to be_success
          expect { transaction.reload }.to raise_error(ActiveRecord::RecordNotFound)
          expect { import_record.reload }.to raise_error(ActiveRecord::RecordNotFound)
        end
      end

      context "when record does not exist" do
        before do
          transaction.destroy
        end

        it "destroys the import_record only" do
          result = operation.send(:destroy_record, import_record: import_record)

          expect(result).to be_success
          expect { import_record.reload }.to raise_error(ActiveRecord::RecordNotFound)
        end
      end

      context "when destroy raises an error" do
        before do
          allow_any_instance_of(Transactions::Expense).to receive(:destroy).and_raise(StandardError.new("Destroy error"))
        end

        it "returns failure with error message" do
          result = operation.send(:destroy_record, import_record: import_record)

          expect(result).to be_failure
          expect(result.failure[:error]).to include("Failed to revert record")
        end
      end
    end

    describe "#revert_category_records" do
      let(:category) { create(:category, space: space) }

      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      before do
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: category.id,
          record_type: "Transactions::Category"
        )
      end

      it "reverts category records" do
        result = operation.send(:revert_category_records, import: import)

        expect(result).to be_success
        expect(result.value![:deleted_count]).to eq(1)
        expect(result.value![:errors]).to be_an(Array)
      end
    end

    describe "#destroy_category_if_safe" do
      let(:category) { create(:category, space: space) }

      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      let(:import_record) do
        create(
          :import_record,
          import: import,
          status: :success,
          record_id: category.id,
          record_type: "Transactions::Category"
        )
      end

      context "when category has no transactions" do
        it "destroys the category and import_record" do
          result = operation.send(:destroy_category_if_safe, import_record: import_record)

          expect(result).to be_success
          expect { category.reload }.to raise_error(ActiveRecord::RecordNotFound)
          expect { import_record.reload }.to raise_error(ActiveRecord::RecordNotFound)
        end
      end

      context "when category has transactions" do
        let(:account) { create(:account, space: space) }
        let!(:transaction) { create(:expense_transaction, space: space, category: category, account: account) }

        it "returns failure and does not destroy category" do
          result = operation.send(:destroy_category_if_safe, import_record: import_record)

          expect(result).to be_failure
          expect(result.failure[:error]).to include("cannot be deleted")
          expect { category.reload }.not_to raise_error
        end

        it "does not destroy the import_record when category has transactions" do
          operation.send(:destroy_category_if_safe, import_record: import_record)

          expect { import_record.reload }.not_to raise_error
        end
      end

      context "when category does not exist" do
        before do
          category.destroy
        end

        it "returns success without destroying anything" do
          result = operation.send(:destroy_category_if_safe, import_record: import_record)

          expect(result).to be_success
        end
      end
    end

    describe "#update_import_status" do
      let(:import) do
        create(
          :import,
          user: user,
          space: space,
          status: "completed"
        )
      end

      it "updates import status to reverted" do
        result = operation.send(:update_import_status, import: import)

        expect(result).to be_success
        expect(import.reload.status).to eq("reverted")
      end
    end

    describe "#merge_results" do
      let(:transaction_result) { { reverted_count: 2, errors: [] } }
      let(:category_result) { { deleted_count: 1, errors: [] } }

      context "when there are no errors" do
        it "returns success message with counts" do
          result = operation.send(:merge_results, transaction_result, category_result)

          expect(result[:message]).to include("2 transactions")
          expect(result[:message]).to include("1 category")
          expect(result[:reverted_count]).to eq(2)
          expect(result[:deleted_categories_count]).to eq(1)
          expect(result).not_to have_key(:warnings)
        end

        context "when there are no items reverted" do
          let(:transaction_result) { { reverted_count: 0, errors: [] } }
          let(:category_result) { { deleted_count: 0, errors: [] } }

          it "returns generic success message" do
            result = operation.send(:merge_results, transaction_result, category_result)

            expect(result[:message]).to eq("Import reverted successfully")
          end
        end

        context "when only transactions are reverted" do
          let(:category_result) { { deleted_count: 0, errors: [] } }

          it "returns message with only transactions" do
            result = operation.send(:merge_results, transaction_result, category_result)

            expect(result[:message]).to include("2 transactions")
            expect(result[:message]).not_to include("category")
          end
        end

        context "when only categories are deleted" do
          let(:transaction_result) { { reverted_count: 0, errors: [] } }

          it "returns message with only categories" do
            result = operation.send(:merge_results, transaction_result, category_result)

            expect(result[:message]).to include("1 category")
            expect(result[:message]).not_to include("transaction")
          end
        end
      end

      context "when there are errors" do
        let(:transaction_result) { { reverted_count: 2, errors: ["Error 1"] } }
        let(:category_result) { { deleted_count: 1, errors: ["Error 2"] } }

        it "returns message with warnings" do
          result = operation.send(:merge_results, transaction_result, category_result)

          expect(result[:message]).to include("warning")
          expect(result[:warnings]).to eq(["Error 1", "Error 2"])
          expect(result[:reverted_count]).to eq(2)
          expect(result[:deleted_categories_count]).to eq(1)
        end

        context "when no items were reverted" do
          let(:transaction_result) { { reverted_count: 0, errors: ["Error 1"] } }
          let(:category_result) { { deleted_count: 0, errors: ["Error 2"] } }

          it "returns message with only warnings" do
            result = operation.send(:merge_results, transaction_result, category_result)

            expect(result[:message]).to include("2 warnings")
            expect(result[:message]).not_to include("deleted")
          end
        end
      end

      context "when singular counts" do
        let(:transaction_result) { { reverted_count: 1, errors: [] } }
        let(:category_result) { { deleted_count: 1, errors: [] } }

        it "uses singular forms in message" do
          result = operation.send(:merge_results, transaction_result, category_result)

          expect(result[:message]).to include("1 transaction")
          expect(result[:message]).to include("1 category")
        end
      end
    end
  end
end
