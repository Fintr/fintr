# frozen_string_literal: true

module Api
  module V1
    module Imports
      class SampleTemplatesController < ApiController
        def show
          operation = ::Imports::Operations::GenerateSampleTemplate.new.call(space_id: current_space.id)

          unless operation.success?
            failure = operation.failure
            error_details = if failure.is_a?(Hash)
              failure
            elsif failure.respond_to?(:to_h)
              failure.to_h
            else
              { error: failure.to_s }
            end
            return render_unprocessable_content(details: error_details)
          end

          result = operation.value!
          file_path = result.is_a?(Hash) ? result[:file_path] : result

          unless file_path && File.exist?(file_path)
            return render_internal_server_error(details: { error: "Generated file not found" })
          end

          # Send file and clean up after response
          send_file(
            file_path,
            filename: "import_template.xlsx",
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            disposition: "attachment"
          ) do
            # Clean up file after response is sent
            File.delete(file_path) if File.exist?(file_path)
          end
        rescue StandardError => e
          Rails.logger.error("Error generating sample template: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))
          render_internal_server_error(details: { error: e.message })
        end
      end
    end
  end
end
