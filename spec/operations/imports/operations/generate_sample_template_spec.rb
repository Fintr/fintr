# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Operations::GenerateSampleTemplate, type: :operation do
  subject(:operation) { described_class.new }

  let(:space) { create(:space) }
  let(:valid_params) do
    {
      space_id: space.id.to_s
    }
  end

  before do
    allow(Rails.logger).to receive(:error)
  end

  describe "Contract" do
    it "succeeds with valid parameters" do
      result = operation.validate(params: valid_params)

      expect(result).to be_success
    end

    it "fails without space_id" do
      params_without_space_id = { space_id: nil }
      result = operation.validate(params: params_without_space_id)

      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end
  end

  describe "#call" do
    context "when all steps succeed" do
      let(:income_category1) { create(:category, space: space, category_type: "income", name: "Salary") }
      let(:income_category2) { create(:category, space: space, category_type: "income", name: "Freelance") }
      let(:expense_category1) { create(:category, space: space, category_type: "expense", name: "Food") }
      let(:expense_category2) { create(:category, space: space, category_type: "expense", name: "Transportation") }

      before do
        income_category1
        income_category2
        expense_category1
        expense_category2
      end

      it "returns success with file_path" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!).to have_key(:file_path)
        expect(result.value![:file_path]).to be_a(String)
        expect(result.value![:file_path]).to include("import_template_")
        expect(result.value![:file_path]).to end_with(".xlsx")
      end

      it "creates the file in tmp directory" do
        result = operation.call(valid_params)

        file_path = result.value![:file_path]
        expect(File.exist?(file_path)).to be true
      end

      it "creates a valid Excel file" do
        result = operation.call(valid_params)

        file_path = result.value![:file_path]
        expect(File.exist?(file_path)).to be true
        expect(File.size(file_path)).to be > 0
      end
    end

    context "when space is not found" do
      let(:invalid_params) do
        {
          space_id: SecureRandom.uuid.to_s
        }
      end

      it "returns failure" do
        result = operation.call(invalid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to eq("Space not found")
      end
    end

    context "when space has no categories" do
      let(:space_without_categories) { create(:space) }

      let(:params_without_categories) do
        {
          space_id: space_without_categories.id.to_s
        }
      end

      it "uses default category names" do
        result = operation.call(params_without_categories)

        expect(result).to be_success
        expect(File.exist?(result.value![:file_path])).to be true
      end
    end

    context "when FastExcel raises an error" do
      before do
        allow(FastExcel).to receive(:open).and_raise(StandardError.new("FastExcel error"))
      end

      it "returns failure with error message" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to include("Failed to generate template")
      end

      it "logs the error" do
        operation.call(valid_params)

        expect(Rails.logger).to have_received(:error).at_least(:once).with(/FastExcel error/)
      end
    end
  end

  describe "private methods" do
    describe "#find_space" do
      context "when space exists" do
        it "returns success with space" do
          result = operation.send(:find_space, space.id.to_s)

          expect(result).to be_success
          expect(result.value!.id).to eq(space.id)
          expect(result.value!).to be_a(Spaces::Space)
        end
      end

      context "when space does not exist" do
        it "returns failure" do
          result = operation.send(:find_space, SecureRandom.uuid.to_s)

          expect(result).to be_failure
          expect(result.failure[:error]).to eq("Space not found")
        end
      end
    end

    describe "#ensure_tmp_directory" do
      it "creates tmp directory if it does not exist" do
        tmp_dir = Rails.root.join("tmp")
        FileUtils.rm_rf(tmp_dir) if Dir.exist?(tmp_dir)

        result = operation.send(:ensure_tmp_directory)

        expect(result).to be_success
        expect(Dir.exist?(tmp_dir)).to be true
      end

      it "returns success when tmp directory already exists" do
        tmp_dir = Rails.root.join("tmp")
        FileUtils.mkdir_p(tmp_dir)

        result = operation.send(:ensure_tmp_directory)

        expect(result).to be_success
        expect(result.value!).to eq(tmp_dir)
      end
    end

    describe "#generate_file_path" do
      let(:tmp_dir) { Rails.root.join("tmp") }

      it "generates a unique file path" do
        result1 = operation.send(:generate_file_path, tmp_dir: tmp_dir)
        result2 = operation.send(:generate_file_path, tmp_dir: tmp_dir)

        expect(result1).to be_success
        expect(result2).to be_success
        expect(result1.value!).not_to eq(result2.value!)
      end

      it "generates path with correct format" do
        result = operation.send(:generate_file_path, tmp_dir: tmp_dir)

        file_path = result.value!
        expect(file_path.to_s).to include("import_template_")
        expect(file_path.to_s).to end_with(".xlsx")
        expect(file_path.to_s).to include(tmp_dir.to_s)
      end
    end

    describe "#create_workbook" do
      let(:space) { create(:space) }
      let(:tmp_dir) { Rails.root.join("tmp") }
      let(:file_path) { tmp_dir.join("test_template.xlsx") }

      after do
        FileUtils.rm_f(file_path) if File.exist?(file_path)
      end

      it "creates a workbook with worksheet" do
        result = operation.send(:create_workbook, space: space, file_path: file_path)

        expect(result).to be_success
        expect(File.exist?(file_path)).to be true
        expect(File.size(file_path)).to be > 0
      end
    end

    describe "#add_headers" do
      let(:tmp_file) { Tempfile.new(["test", ".xlsx"]) }
      let(:workbook) { FastExcel.open(tmp_file.path, constant_memory: true) }
      let(:worksheet) { workbook.add_worksheet("Test") }

      after do
        workbook.close
        tmp_file.close
        tmp_file.unlink
      end

      it "adds headers to worksheet" do
        result = operation.send(:add_headers, worksheet: worksheet)

        expect(result).to be_success
      end
    end

    describe "#add_sample_rows" do
      let(:tmp_file) { Tempfile.new(["test", ".xlsx"]) }
      let(:workbook) { FastExcel.open(tmp_file.path, constant_memory: true) }
      let(:worksheet) { workbook.add_worksheet("Test") }
      let(:sample_rows) do
        [
          ["2024-01-01", "Test 1", "100.00", "income", "Salary"],
          ["2024-01-02", "Test 2", "200.00", "expense", "Food"]
        ]
      end

      after do
        workbook.close
        tmp_file.close
        tmp_file.unlink
      end

      it "adds all sample rows to worksheet" do
        result = operation.send(:add_sample_rows, worksheet: worksheet, sample_rows: sample_rows)

        expect(result).to be_success
      end
    end

    describe "#generate_sample_rows" do
      context "when space has categories" do
        let(:space) { create(:space) }
        let(:income_category1) { create(:category, space: space, category_type: "income", name: "Salary") }
        let(:income_category2) { create(:category, space: space, category_type: "income", name: "Freelance") }
        let(:expense_category1) { create(:category, space: space, category_type: "expense", name: "Food") }
        let(:expense_category2) { create(:category, space: space, category_type: "expense", name: "Transportation") }

        before do
          income_category1
          income_category2
          expense_category1
          expense_category2
        end

        it "returns 5 sample rows" do
          result = operation.send(:generate_sample_rows, space: space)

          expect(result).to be_success
          expect(result.value!.length).to eq(5)
        end

        it "uses space categories" do
          result = operation.send(:generate_sample_rows, space: space)

          rows = result.value!
          income_rows = rows.select { |row| row[3] == "income" }
          expense_rows = rows.select { |row| row[3] == "expense" }

          expect(income_rows.any? { |row| [income_category1.name, income_category2.name].include?(row[4]) }).to be true
          expect(expense_rows.any? { |row| [expense_category1.name, expense_category2.name].include?(row[4]) }).to be true
        end

        it "includes correct date formats" do
          result = operation.send(:generate_sample_rows, space: space)

          rows = result.value!
          rows.each do |row|
            expect(row[0]).to match(/\d{4}-\d{2}-\d{2}/)
          end
        end

        it "includes income and expense types" do
          result = operation.send(:generate_sample_rows, space: space)

          rows = result.value!
          types = rows.map { |row| row[3] }

          expect(types).to include("income")
          expect(types).to include("expense")
        end
      end

      context "when space has no categories" do
        let(:space_without_categories) { create(:space) }

        it "uses default category names" do
          result = operation.send(:generate_sample_rows, space: space_without_categories)

          rows = result.value!
          income_rows = rows.select { |row| row[3] == "income" }
          expense_rows = rows.select { |row| row[3] == "expense" }

          income_categories = income_rows.map { |row| row[4] }
          expense_categories = expense_rows.map { |row| row[4] }

          expect(income_categories.any? { |cat| ["Salary", "Freelance"].include?(cat) }).to be true
          expect(expense_categories.any? { |cat| ["Food", "Transportation"].include?(cat) }).to be true
        end
      end

      context "when space has partial categories" do
        let(:space) { create(:space) }
        let(:income_category) { create(:category, space: space, category_type: "income", name: "Salary") }

        before do
          income_category
        end

        it "uses available categories and defaults for missing ones" do
          result = operation.send(:generate_sample_rows, space: space)

          rows = result.value!
          expense_rows = rows.select { |row| row[3] == "expense" }
          expense_categories = expense_rows.map { |row| row[4] }

          # Should use default expense categories
          expect(expense_categories.any? { |cat| ["Food", "Transportation"].include?(cat) }).to be true
        end
      end
    end
  end
end
