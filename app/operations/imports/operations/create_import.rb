# frozen_string_literal: true

require "dry/operation/extensions/active_record"
module Imports
  module Operations
    class CreateImport < Dry::Operation
      class Contract < Dry::Validation::Contract
        params do
          required(:user_id).value(:string)
          required(:space_id).value(:string) # Comes from with_current_params
          required(:import_location).value(:string)
          required(:file).value(:any)
          optional(:metadata).value(:hash)
        end

        rule(:import_location) do
          key.failure("must be 'onboarding' or 'settings'") unless %w[onboarding settings].include?(value)
        end
      end

      def validate(params:)
        contract = Contract.new.call(**params)
        return Failure(contract.errors.to_h) unless contract.success?

        Success(contract.to_h)
      end

      include FailureHandler
      include Dry::Operation::Extensions::ActiveRecord

      def call(params)
        transaction do
          params = step validate(params:)
          import = step create_import_record(params:)
          _ = step attach_file(import:, file: params[:file])
          # Wait for file to be available in storage before enqueueing job
          _ = step ensure_file_available(import:)
          _ = step enqueue_processing_job(import:)

          import
        end
      end

      private

      def create_import_record(params:)
        # Prevent duplicate imports: check if there's a recent pending/processing import
        # within the last 5 seconds to prevent accidental double-clicks
        recent_import = Imports::Import.where(
          user_id: params[:user_id],
          space_id: params[:space_id],
          status: %w[pending processing]
        ).where("created_at > ?", 5.seconds.ago).first

        if recent_import
          return Failure(
            error: "An import is already in progress. Please wait for it to complete.",
            errors: { base: ["Duplicate import detected"] }
          )
        end

        import = Imports::Import.create!(
          user_id: params[:user_id],
          space_id: params[:space_id],
          import_location: params[:import_location],
          status: "pending",
          metadata: params[:metadata] || {}
        )
        Success(import)
      rescue ActiveRecord::RecordInvalid => e
        Failure(error: e.message, errors: e.record.errors.to_hash)
      end

      def attach_file(import:, file:)
        # Store file in ActiveStorage
        return Failure(error: "No file provided") unless file.present?

        # Read file content into memory first
        file.rewind if file.respond_to?(:rewind)
        file_content = file.read
        file.rewind if file.respond_to?(:rewind)

        # Create blob manually for better control over upload
        # Use space_id in key to organize files by space (similar to Utils::ActiveStorage)
        blob = ActiveStorage::Blob.create_and_upload!(
          io: StringIO.new(file_content),
          filename: file.original_filename,
          content_type: file.content_type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          key: "spaces/#{import.space_id}/#{SecureRandom.uuid}-#{file.original_filename}"
        )

        # Attach the already-uploaded blob (this is synchronous)
        import.file.attach(blob)

        # Reload to ensure attachment is persisted
        import.reload

        # Verify the attachment exists
        return Failure(error: "Failed to attach file: attachment not found after attach") unless import.file.attached?

        # Verify blob exists
        attached_blob = import.file.blob
        return Failure(error: "Failed to attach file: blob not found after attach") unless attached_blob

        # For remote storage, verify file exists in storage
        if attached_blob.service_name == "amazon" || attached_blob.service_name == "google" || attached_blob.service_name == "microsoft"
          begin
            unless attached_blob.service.exist?(attached_blob.key)
              Rails.logger.error("File not found in storage after create_and_upload!")
              return Failure(error: "File upload failed. Please try uploading again.")
            end
            Rails.logger.info("File successfully uploaded and verified in #{attached_blob.service_name}")
          rescue StandardError => e
            Rails.logger.error("Error verifying file in storage: #{e.message}")
            return Failure(error: "Failed to verify file upload: #{e.message}")
          end
        end

        Success(true)
      rescue StandardError => e
        Failure(error: "Failed to attach file: #{e.message}")
      end

      def ensure_file_available(import:)
        # File should already be verified in attach_file, but double-check
        # This is a lightweight verification before enqueueing the job
        blob = import.file.blob
        return Success(true) unless blob

        # Quick verification for remote storage
        if blob.service_name == "amazon" || blob.service_name == "google" || blob.service_name == "microsoft"
          begin
            unless blob.service.exist?(blob.key)
              Rails.logger.error("File not found in storage during ensure_file_available")
              return Failure(error: "File not available in storage. Please try uploading again.")
            end
            Rails.logger.info("File verified available before enqueueing job")
          rescue StandardError => e
            Rails.logger.error("Error verifying file: #{e.message}")
            return Failure(error: "Failed to verify file: #{e.message}")
          end
        end

        Success(true)
      end

      def enqueue_processing_job(import:)
        Imports::ProcessImportJob.perform_later(import.id)
        Success(true)
      end
    end
  end
end
