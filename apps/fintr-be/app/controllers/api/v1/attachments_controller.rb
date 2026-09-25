# frozen_string_literal: true

module Api
  module V1
    # Streams a stored attachment after the signed-in user is checked against
    # the space that owns the file.
    class AttachmentsController < ApiController
      def download
        result = ::Attachments::Operations::Download.new.call(
          url: params[:url].to_s,
          space_id: current_space.id.to_s
        )
        return render_download_failure(result.failure) unless result.success?

        file = result.value!
        send_data(
          file[:data],
          filename: file[:filename],
          type: file[:content_type],
          disposition: "inline"
        )
      end

      private

      def render_download_failure(failure)
        return render_not_found(message: "Attachment not found") if failure[:file] == "not found"
        return render_bad_request(message: "Invalid attachment url") if failure[:url] == "invalid"
        return render_bad_request(message: "Missing url parameter") if failure[:url].is_a?(Array)

        render_forbidden(
          message: "URL not allowed",
          details: "Only attachments in the current space are allowed"
        )
      end
    end
  end
end
