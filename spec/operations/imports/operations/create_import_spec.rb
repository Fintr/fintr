# frozen_string_literal: true

require "rails_helper"

RSpec.describe Imports::Operations::CreateImport, type: :operation do
  subject(:operation) { described_class.new }

  let(:user) { create(:user) }
  let(:space) { create(:space) }
  let(:file) do
    fixture_file_upload(
      Rails.root.join("spec/fixtures/files/test.txt"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
  end
  let(:valid_params) do
    {
      user_id: user.id.to_s,
      space_id: space.id.to_s,
      import_location: "settings",
      file: file,
      metadata: {}
    }
  end

  before do
    allow(Rails.logger).to receive(:info)
    allow(Rails.logger).to receive(:error)
    allow(Imports::ProcessImportJob).to receive(:perform_later)
  end

  describe "Contract" do
    it "succeeds with valid parameters" do # rubocop:disable RSpec/RepeatedExample
      result = operation.validate(params: valid_params)

      expect(result).to be_success
    end

    it "fails without user_id" do
      params_without_user_id = valid_params.except(:user_id)
      result = operation.validate(params: params_without_user_id)

      expect(result).to be_failure
      expect(result.failure).to have_key(:user_id)
    end

    it "fails without space_id" do
      params_without_space_id = valid_params.except(:space_id)
      result = operation.validate(params: params_without_space_id)

      expect(result).to be_failure
      expect(result.failure).to have_key(:space_id)
    end

    it "fails without import_location" do
      params_without_import_location = valid_params.except(:import_location)
      result = operation.validate(params: params_without_import_location)

      expect(result).to be_failure
      expect(result.failure).to have_key(:import_location)
    end

    it "fails without file" do
      params_without_file = valid_params.except(:file)
      result = operation.validate(params: params_without_file)

      expect(result).to be_failure
      expect(result.failure).to have_key(:file)
    end

    it "fails with invalid import_location" do
      params_with_invalid_location = valid_params.merge(import_location: "invalid")
      result = operation.validate(params: params_with_invalid_location)

      expect(result).to be_failure
      expect(result.failure).to have_key(:import_location)
    end

    it "succeeds with import_location 'onboarding'" do
      params_with_onboarding = valid_params.merge(import_location: "onboarding")
      result = operation.validate(params: params_with_onboarding)

      expect(result).to be_success
    end

    it "succeeds with import_location 'settings'" do
      params_with_settings = valid_params.merge(import_location: "settings")
      result = operation.validate(params: params_with_settings)

      expect(result).to be_success
    end

    it "succeeds without metadata" do
      params_without_metadata = valid_params.except(:metadata)
      result = operation.validate(params: params_without_metadata)

      expect(result).to be_success
    end

    it "succeeds with metadata hash" do
      params_with_metadata = valid_params.merge(metadata: { key: "value" })
      result = operation.validate(params: params_with_metadata)

      expect(result).to be_success
    end
  end

  describe "#call" do
    context "when all steps succeed" do
      it "creates an import record" do
        expect { operation.call(valid_params) }.to change(Imports::Import, :count).by(1)
      end

      it "creates import with correct attributes" do
        result = operation.call(valid_params)

        expect(result).to be_success
        import = result.value!
        expect(import.user_id).to eq(user.id)
        expect(import.space_id).to eq(space.id)
        expect(import.import_location).to eq("settings")
        expect(import.status).to eq("pending")
        expect(import.metadata).to eq({})
      end

      it "attaches the file to the import" do
        result = operation.call(valid_params)

        import = result.value!
        expect(import.file).to be_attached
      end

      it "enqueues ProcessImportJob" do
        result = operation.call(valid_params)

        import = result.value!
        expect(Imports::ProcessImportJob).to have_received(:perform_later).with(import.id)
      end

      it "returns the created import" do
        result = operation.call(valid_params)

        expect(result).to be_success
        expect(result.value!).to be_a(Imports::Import)
      end

      context "with metadata" do
        let(:params_with_metadata) do
          valid_params.merge(metadata: { source: "api", version: "1.0" })
        end

        it "saves metadata to import" do
          result = operation.call(params_with_metadata)

          import = result.value!
          expect(import.metadata).to eq({ "source" => "api", "version" => "1.0" })
        end
      end

      context "with onboarding location" do
        let(:params_with_onboarding) do
          valid_params.merge(import_location: "onboarding")
        end

        it "creates import with onboarding location" do
          result = operation.call(params_with_onboarding)

          import = result.value!
          expect(import.import_location).to eq("onboarding")
        end
      end
    end

    context "when duplicate import is detected" do
      let!(:recent_import) do
        Imports::Import.create!(
          user_id: user.id,
          space_id: space.id,
          import_location: "settings",
          status: "pending",
          created_at: 2.seconds.ago
        )
      end

      it "returns failure with duplicate error" do
        result = operation.call(valid_params)

        expect(result).to be_failure
        expect(result.failure[:error]).to eq("An import is already in progress. Please wait for it to complete.")
        expect(result.failure[:errors][:base]).to include("Duplicate import detected")
      end

      it "does not create a new import" do
        expect { operation.call(valid_params) }.not_to change(Imports::Import, :count)
      end

      it "does not enqueue job" do
        operation.call(valid_params)

        expect(Imports::ProcessImportJob).not_to have_received(:perform_later)
      end
    end

    context "when file attachment fails" do
      context "when file is not provided" do
        let(:params_without_file) { valid_params.except(:file) }

        it "returns failure" do
          # Skip validation by directly calling attach_file
          import = Imports::Import.create!(
            user_id: user.id,
            space_id: space.id,
            import_location: "settings",
            status: "pending"
          )
          result = operation.send(:attach_file, import: import, file: nil)

          expect(result).to be_failure
          expect(result.failure[:error]).to eq("No file provided")
        end
      end

      context "when file attachment raises an error" do
        before do
          allow_any_instance_of(Imports::Import).to receive(:file).and_raise(StandardError.new("Attachment error"))
        end

        it "returns failure with error message" do
          result = operation.call(valid_params)

          expect(result).to be_failure
          expect(result.failure[:error]).to include("Failed to attach file")
        end
      end

      context "when blob creation fails" do
        before do
          allow(ActiveStorage::Blob).to receive(:create_and_upload!).and_raise(StandardError.new("Blob error"))
        end

        it "returns failure with error message" do
          result = operation.call(valid_params)

          expect(result).to be_failure
          expect(result.failure[:error]).to include("Failed to attach file")
        end
      end
    end

    describe "#create_import_record" do
      context "when import creation succeeds" do
        it "creates import with correct attributes" do
          result = operation.send(:create_import_record, params: valid_params)

          expect(result).to be_success
          import = result.value!
          expect(import.user_id.to_s).to eq(valid_params[:user_id])
          expect(import.space_id.to_s).to eq(valid_params[:space_id])
          expect(import.import_location).to eq(valid_params[:import_location])
          expect(import.status).to eq("pending")
          expect(import.metadata).to eq({})
        end

        it "uses provided metadata" do
          params_with_metadata = valid_params.merge(metadata: { key: "value" })
          result = operation.send(:create_import_record, params: params_with_metadata)

          import = result.value!
          expect(import.metadata).to eq({ "key" => "value" })
        end

        it "uses empty hash when metadata is not provided" do
          params_without_metadata = valid_params.except(:metadata)
          result = operation.send(:create_import_record, params: params_without_metadata)

          import = result.value!
          expect(import.metadata).to eq({})
        end
      end

      context "when import creation fails validation" do
        before do
          allow(Imports::Import).to receive(:create!).and_raise(
            ActiveRecord::RecordInvalid.new(
              Imports::Import.new.tap do |i|
                i.errors.add(:import_location, "is invalid")
              end
            )
          )
        end

        it "returns failure with validation errors" do
          result = operation.send(:create_import_record, params: valid_params)

          expect(result).to be_failure
          expect(result.failure).to have_key(:error)
          expect(result.failure).to have_key(:errors)
        end
      end
    end

    describe "#attach_file" do
      let(:import) do
        Imports::Import.create!(
          user_id: user.id,
          space_id: space.id,
          import_location: "settings",
          status: "pending"
        )
      end

      context "when file attachment succeeds" do
        it "attaches file to import" do
          result = operation.send(:attach_file, import: import, file: file)

          expect(result).to be_success
          expect(import.reload.file).to be_attached
        end

        it "creates blob with correct attributes" do
          result = operation.send(:attach_file, import: import, file: file)

          expect(result).to be_success
          blob = import.reload.file.blob
          expect(blob).to be_present
          expect(blob.filename.to_s).to eq(file.original_filename)
        end

        it "uses correct content type" do
          result = operation.send(:attach_file, import: import, file: file)

          expect(result).to be_success
          blob = import.reload.file.blob
          expect(blob.content_type).to eq("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        end
      end

      context "when file is not provided" do
        it "returns failure" do
          result = operation.send(:attach_file, import: import, file: nil)

          expect(result).to be_failure
          expect(result.failure[:error]).to eq("No file provided")
        end
      end

      context "when file attachment fails" do
        before do
          allow(ActiveStorage::Blob).to receive(:create_and_upload!).and_raise(StandardError.new("Upload error"))
        end

        it "returns failure with error message" do
          result = operation.send(:attach_file, import: import, file: file)

          expect(result).to be_failure
          expect(result.failure[:error]).to include("Failed to attach file")
        end
      end
    end

    describe "#ensure_file_available" do
      let(:import) do
        import = Imports::Import.create!(
          user_id: user.id,
          space_id: space.id,
          import_location: "settings",
          status: "pending"
        )
        # Attach a file for testing
        import.file.attach(
          io: StringIO.new("test"),
          filename: "test.xlsx",
          content_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        import
      end

      it "returns success when file is available" do
        result = operation.send(:ensure_file_available, import: import)

        expect(result).to be_success
      end
    end

    describe "#enqueue_processing_job" do
      let(:import) do
        Imports::Import.create!(
          user_id: user.id,
          space_id: space.id,
          import_location: "settings",
          status: "pending"
        )
      end

      it "enqueues ProcessImportJob with import id" do
        result = operation.send(:enqueue_processing_job, import: import)

        expect(result).to be_success
        expect(Imports::ProcessImportJob).to have_received(:perform_later).with(import.id)
      end
    end
  end
end
