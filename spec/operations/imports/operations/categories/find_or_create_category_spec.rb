# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Operations::Categories::FindOrCreateCategory do
  include Dry::Monads[:result]

  let(:operation) { described_class.new }
  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:import) do
    Imports::Import.create!(
      user: user,
      space: space,
      import_location: "onboarding",
      status: "pending"
    )
  end

  let(:valid_params) do
    {
      space_id: space.id.to_s,
      row_number: 1,
      import: import,
      row_data: {
        category_name: "Groceries",
        category_type: "expense"
      }
    }
  end

  describe "#call" do
    context "with invalid parameters" do
      context "when space_id is missing" do
        subject(:call_operation) { operation.call(valid_params.except(:space_id)) }

        it { is_expected.to be_failure }

        it "returns a failure with space_id missing error" do
          expect(call_operation.failure).to have_key(:space_id)
        end
      end

      context "when row_number is missing" do
        subject(:call_operation) { operation.call(valid_params.except(:row_number)) }

        it { is_expected.to be_failure }

        it "returns a failure with row_number missing error" do
          expect(call_operation.failure).to have_key(:row_number)
        end
      end

      context "when import is missing" do
        subject(:call_operation) { operation.call(valid_params.except(:import)) }

        it { is_expected.to be_failure }

        it "returns a failure with import missing error" do
          expect(call_operation.failure).to have_key(:import)
        end
      end

      context "when row_data is missing" do
        subject(:call_operation) { operation.call(valid_params.except(:row_data)) }

        it { is_expected.to be_failure }

        it "returns a failure with row_data missing error" do
          expect(call_operation.failure).to have_key(:row_data)
        end
      end

      context "when category_name is missing" do
        subject(:call_operation) do
          operation.call(
            valid_params.merge(
              row_data: {
                category_type: "expense"
              }
            )
          )
        end

        it { is_expected.to be_failure }

        it "returns a failure with category_name missing error" do
          expect(call_operation.failure[:row_data]).to have_key(:category_name)
        end
      end

      context "when category_type is missing" do
        subject(:call_operation) do
          operation.call(
            valid_params.merge(
              row_data: {
                category_name: "Groceries"
              }
            )
          )
        end

        it { is_expected.to be_failure }

        it "returns a failure with category_type missing error" do
          expect(call_operation.failure[:row_data]).to have_key(:category_type)
        end
      end
    end

    context "with valid parameters" do
      context "when category does not exist" do
        subject(:call_operation) { operation.call(valid_params) }

        it { is_expected.to be_success }

        it "creates a new category" do
          expect { call_operation }.to change(Transactions::Category, :count).by(1)
        end

        it "creates category with correct attributes" do
          result = call_operation.value!
          category = result[:category]
          expect(category).to be_a(Transactions::Category)
          expect(category.name).to eq("Groceries")
          expect(category.category_type).to eq("expense")
          expect(category.space_id).to eq(space.id)
        end

        it "returns was_new as true" do
          result = call_operation.value!
          expect(result[:was_new]).to be(true)
        end

        it "creates an import record for the category" do
          expect { call_operation }.to change(Imports::ImportRecord, :count).by(1)
        end

        it "creates import record with correct attributes" do
          call_operation
          import_record = import.import_records.last
          expect(import_record.record_type).to eq("Transactions::Category")
          expect(import_record.status).to eq("success")
          expect(import_record.row_number).to eq(1)
        end
      end

      context "when category already exists" do
        subject(:call_operation) { operation.call(valid_params) }

        let!(:existing_category) do
          create(
            :category,
            space: space,
            name: "Groceries",
            category_type: "expense"
          )
        end


        it { is_expected.to be_success }

        it "does not create a new category" do
          expect { call_operation }.not_to change(Transactions::Category, :count)
        end

        it "returns the existing category" do
          result = call_operation.value!
          expect(result[:category].id).to eq(existing_category.id)
        end

        it "returns was_new as false" do
          result = call_operation.value!
          expect(result[:was_new]).to be(false)
        end

        it "does not create an import record" do
          expect { call_operation }.not_to change(Imports::ImportRecord, :count)
        end
      end

      context "when category exists in a different space" do
        subject(:call_operation) { operation.call(valid_params) }

        let(:other_space) { create(:personal_space) }
        let!(:other_space_category) do
          create(
            :category,
            space: other_space,
            name: "Groceries",
            category_type: "expense"
          )
        end


        it { is_expected.to be_success }

        it "creates a new category for the current space" do
          expect { call_operation }.to change(Transactions::Category, :count).by(1)
        end

        it "creates category with correct space_id" do
          result = call_operation.value!
          expect(result[:category].space_id).to eq(space.id)
          expect(result[:category].id).not_to eq(other_space_category.id)
        end
      end

      context "when category with same name but different type exists" do
        subject(:call_operation) { operation.call(valid_params) }

        let!(:existing_category) do
          create(
            :category,
            space: space,
            name: "Groceries",
            category_type: "income"
          )
        end


        it { is_expected.to be_success }

        it "creates a new category" do
          expect { call_operation }.to change(Transactions::Category, :count).by(1)
        end

        it "creates category with expense type" do
          result = call_operation.value!
          expect(result[:category].category_type).to eq("expense")
          expect(result[:category].id).not_to eq(existing_category.id)
        end
      end

      context "when handling race conditions" do
        context "when category is created between find and create" do
          subject(:call_operation) { operation.call(valid_params) }

          before do
            # Simulate race condition: first find returns nil, then create fails due to uniqueness
            allow(Transactions::Category).to receive(:find_by).and_return(nil, existing_category)
            allow(Transactions::Category).to receive(:create!).and_raise(
              ActiveRecord::RecordNotUnique.new("Duplicate entry")
            )
          end

          let!(:existing_category) do
            create(
              :category,
              space: space,
              name: "Groceries",
              category_type: "expense"
            )
          end


          it { is_expected.to be_success }

          it "returns the existing category" do
            result = call_operation.value!
            expect(result[:category].id).to eq(existing_category.id)
          end

          it "returns was_new as false" do
            result = call_operation.value!
            expect(result[:was_new]).to be(false)
          end
        end

        context "when import record creation has race condition" do
          subject(:call_operation) { operation.call(valid_params.merge(row_data: { category_name: "New Category", category_type: "expense" })) }

          let!(:existing_category) do
            create(
              :category,
              space: space,
              name: "Groceries",
              category_type: "expense"
            )
          end

          before do
            # First call creates the record, second call (race condition) fails
            allow(import.import_records).to receive(:find_or_create_by!).and_call_original
            allow(import.import_records).to receive(:find_or_create_by!).and_raise(
              ActiveRecord::RecordNotUnique.new("Duplicate entry")
            ).once
          end


          it { is_expected.to be_success }

          it "handles the race condition gracefully" do
            # Create the category first
            new_category = create(:category, space: space, name: "New Category", category_type: "expense")
            # Create import record manually to simulate race condition
            import.import_records.create!(
              record_type: new_category.class.name,
              record_id: new_category.id,
              import: import,
              row_number: 1,
              status: "success"
            )

            # Now call operation - it should handle the duplicate gracefully
            result = call_operation
            expect(result).to be_success
          end
        end
      end

      context "when creating import record fails with RecordInvalid" do
        subject(:call_operation) { operation.call(valid_params) }

        before do
          allow(import.import_records).to receive(:find_or_create_by!).and_raise(
            ActiveRecord::RecordInvalid.new(import.import_records.build)
          )
        end


        it { is_expected.to be_success }

        it "handles the error gracefully" do
          result = call_operation
          expect(result).to be_success
        end
      end

      context "when category creation fails with RecordInvalid" do
        subject(:call_operation) { operation.call(valid_params) }

        before do
          allow(Transactions::Category).to receive(:find_by).and_return(nil)
          allow(Transactions::Category).to receive(:create!).and_raise(
            ActiveRecord::RecordInvalid.new(Transactions::Category.new)
          )
        end


        it { is_expected.to be_failure }

        it "returns a failure with error message" do
          expect(call_operation.failure).to have_key(:error)
        end
      end

      context "when category is not found after creation attempt" do
        subject(:call_operation) { operation.call(valid_params) }

        before do
          allow(Transactions::Category).to receive(:find_by).and_return(nil)
          allow(Transactions::Category).to receive(:create!).and_return(true)
          allow(Transactions::Category).to receive(:find_by!).and_raise(
            ActiveRecord::RecordNotFound.new("Category not found")
          )
        end


        it { is_expected.to be_failure }

        it "returns a failure with appropriate error message" do
          expect(call_operation.failure[:error]).to include("Category not found after creation attempt")
        end
      end
    end
  end
end
