# frozen_string_literal: true

module Api
  module V1
    class ReceiptsController < ApiController
      def create
        begin
          # Upload and save the image file first
          uploaded_file = params[:image]
          return render_bad_request(message: "Image file is required") unless uploaded_file

          image_path = save_uploaded_image(uploaded_file)

          # Process the receipt
          processing_params = with_current_params(
            image_path: image_path,
            auto_create_transaction: auto_create_transaction?,
            processing_method: "pure_ai"
          )

          operation = ::Ai::Operations::Usages::CreateUsage.new.call(processing_params) do
            ::Ai::Operations::Receipts::ProcessReceipt.new.call(params: processing_params)
          end

          # Clean up temporary files
          cleanup_temporary_files(image_path)

          return render_internal_server_error(message: "Receipt processing failed", details: operation.failure) unless operation.success?

          # Add processing time to response
          result = operation.value!

          render_success(
            data: result,
            message: "Receipt processed successfully"
          )

        rescue StandardError => e
          # Clean up any temporary files on error
          cleanup_temporary_files(image_path) if defined?(image_path)

          Rails.logger.error("Receipt processing error: #{e.message}")
          render_internal_server_error(
            message: "Receipt processing failed",
            details: { error: e.message }
          )
        end
      end

      def process_test
        # Development/testing endpoint to process a test receipt
        return render_forbidden unless Rails.env.development? || Rails.env.test?

        test_image_path = params[:test_image_path]
        return render_bad_request(message: "test_image_path parameter required") unless test_image_path
        return render_not_found(message: "Test image file not found") unless File.exist?(test_image_path)

        processing_params = with_current_params(
          image_path: test_image_path,
          auto_create_transaction: false # Don't auto-create for tests
        )

        operation = ::Ai::Operations::Receipts::ProcessReceipt.new.call(params: processing_params)

        return render_internal_server_error(details: operation.failure) unless operation.success?

        render_success(
          data: operation.value!,
          message: "Test receipt processed successfully"
        )
      end

      private

      def save_uploaded_image(uploaded_file)
        # Validate file type
        unless image_file?(uploaded_file.original_filename)
          raise ArgumentError, "Invalid file type. Only images are allowed."
        end

        # Validate file size (max 10MB)
        max_size = 10.megabytes
        if uploaded_file.size > max_size
          raise ArgumentError, "File too large. Maximum size is #{max_size / 1.megabyte}MB."
        end

        # Create temporary directory if it doesn't exist
        temp_dir = Rails.root.join("tmp", "receipt_processing")
        FileUtils.mkdir_p(temp_dir)

        # Generate unique filename
        timestamp = Time.current.to_i
        random_suffix = SecureRandom.hex(8)
        file_extension = File.extname(uploaded_file.original_filename)
        filename = "receipt_#{timestamp}_#{random_suffix}#{file_extension}"

        # Save the file
        temp_path = temp_dir.join(filename)
        File.open(temp_path, "wb") do |file|
          file.write(uploaded_file.read)
        end

        temp_path.to_s
      end

      def image_file?(filename)
        allowed_extensions = %w[.jpg .jpeg .png .bmp .tiff .tif]
        extension = File.extname(filename).downcase
        allowed_extensions.include?(extension)
      end

      def auto_create_transaction?
        # Convert string/boolean parameter to boolean
        case params[:auto_create_transaction]
        when "true", true
          true
        when "false", false, nil
          false
        else
          false
        end
      end

      def cleanup_temporary_files(*file_paths)
        file_paths.compact.each do |file_path|
          next unless file_path && File.exist?(file_path)

          begin
            File.delete(file_path)

            # Also clean up optimized versions
            optimized_path = file_path.gsub(/(\.[^.]+)$/, '_optimized\1')
            File.delete(optimized_path) if File.exist?(optimized_path)

          rescue StandardError => e
            Rails.logger.warn("Failed to clean up temporary file #{file_path}: #{e.message}")
          end
        end
      end
    end
  end
end
