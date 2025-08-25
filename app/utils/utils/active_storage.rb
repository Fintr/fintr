# frozen_string_literal: true

module Utils
  class ActiveStorage
    class << self
      def attach_file(active_storage_relation, file, space_id)
        params = {
          io: file,
          filename: file.original_filename,
          content_type: file.content_type,
          key: "spaces/#{space_id}/#{SecureRandom.uuid}-#{file.original_filename}",
          identify: false
        }
        active_storage_relation.attach(params)
      end
    end
  end
end
