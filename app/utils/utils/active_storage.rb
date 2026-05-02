# frozen_string_literal: true

require "set"

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

      # Shares the same blob records as +source_record+ on +target_record+ (no duplicate bytes in storage).
      # Safe across recurring series: replacing files on the child only removes that record's attachment rows;
      # the blob is only removed from storage when no attachments reference it (see ActiveStorage::Blob validations).
      def attach_same_blobs_from(source_record:, target_record:, name: :files)
        source = source_record.public_send(name)
        return unless source.attached?

        target = target_record.public_send(name)
        existing_blob_ids = target.blobs.map(&:id).to_set
        source.blobs.each do |blob|
          next if existing_blob_ids.include?(blob.id)

          target.attach(blob)
          existing_blob_ids << blob.id
        end
      end

      # When the parent is saved before +files+ are attached (e.g. +CreateTransaction+ / +CreateTransfer+),
      # run this after attach so children created in the same request get the same blobs.
      def sync_template_files_to_children(source_record:, name: :files)
        return unless source_record.public_send(name).attached?
        return unless source_record.respond_to?(:children)

        source_record.children.find_each do |child|
          attach_same_blobs_from(
            source_record:,
            target_record: child,
            name:
          )
        end
      end
    end
  end
end
