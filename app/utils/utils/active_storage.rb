# frozen_string_literal: true

module Utils
  class ActiveStorage
    class << self
      def attach_file(active_storage_relation, file, space_id, file_id: nil)
        return attach_existing_file(active_storage_relation, file_id) if file_id.present?

        params = {
          io: file,
          filename: file.original_filename,
          content_type: file.content_type,
          key: "spaces/#{space_id}/#{SecureRandom.uuid}-#{file.original_filename}",
          identify: false
        }
        active_storage_relation.attach(params)
      end

      def attach_existing_file(active_storage_relation, file_id)
        attachment = ::ActiveStorage::Attachment.find_by(id: file_id)
        existing_blob = attachment.blob
        return false unless existing_blob

        active_storage_relation.attach(existing_blob)
      end
    end
  end
end
