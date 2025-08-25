# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Utils::ActiveStorage do
  describe '.attach_file' do
    let(:space_id) { SecureRandom.uuid }
    let(:filename) { 'test.jpg' }
    let(:content_type) { 'image/jpeg' }
    let(:file) do
      fixture_file_upload(
        Rails.root.join('spec', 'fixtures', 'files', 'test.jpg'),
        content_type
      )
    end
    let(:active_storage_relation) { instance_double(ActiveStorage::Attached::Many) }

    before do
      allow(active_storage_relation).to receive(:attach)
    end

    it 'calls attach on the active storage relation with correct parameters' do
      described_class.attach_file(active_storage_relation, file, space_id)

      expect(active_storage_relation).to have_received(:attach).with(
        hash_including(
          io: file,
          filename: filename,
          content_type: content_type,
          identify: false
        )
      ).once
    end

    it 'uses the file original filename' do
      described_class.attach_file(active_storage_relation, file, space_id)

      expect(active_storage_relation).to have_received(:attach).with(
        hash_including(filename: filename)
      ).once
    end

    it 'uses the file content type' do
      described_class.attach_file(active_storage_relation, file, space_id)

      expect(active_storage_relation).to have_received(:attach).with(
        hash_including(content_type: content_type)
      ).once
    end



    it 'sets identify to false' do
      described_class.attach_file(active_storage_relation, file, space_id)

      expect(active_storage_relation).to have_received(:attach).with(
        hash_including(identify: false)
      ).once
    end

    it 'generates a key with the correct format' do
      described_class.attach_file(active_storage_relation, file, space_id)

      expect(active_storage_relation).to have_received(:attach).with(
        hash_including(
          key: /^spaces\/#{space_id}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-#{filename}$/
        )
      ).once
    end

    context 'with different file types' do
      let(:pdf_filename) { 'document.pdf' }
      let(:pdf_content_type) { 'application/pdf' }
      let(:pdf_file) do
        fixture_file_upload(
          Rails.root.join('spec', 'fixtures', 'files', 'test.txt'),
          pdf_content_type
        )
      end


      before do
        allow(pdf_file).to receive(:original_filename).and_return(pdf_filename)
      end

      it 'handles PDF files correctly' do
        described_class.attach_file(active_storage_relation, pdf_file, space_id)

        expect(active_storage_relation).to have_received(:attach).with(
          hash_including(
            io: pdf_file,
            filename: pdf_filename,
            content_type: pdf_content_type,
            identify: false
          )
        ).once
      end
    end

    context 'with different space IDs' do
      let(:different_space_id) { SecureRandom.uuid }


      it 'uses the provided space ID for S3 key generation' do
        described_class.attach_file(active_storage_relation, file, different_space_id)

        expect(active_storage_relation).to have_received(:attach).with(
          hash_including(
            key: /^spaces\/#{different_space_id}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-#{filename}$/
          )
        ).once
      end
    end

    context 'with files that have special characters in filename' do
      let(:special_filename) { 'test file with spaces & symbols.jpg' }
      let(:file_with_special_name) do
        fixture_file_upload(
          Rails.root.join('spec', 'fixtures', 'files', 'test.jpg'),
          content_type
        )
      end

      before do
        allow(file_with_special_name).to receive(:original_filename).and_return(special_filename)
      end

      it 'handles filenames with special characters correctly' do
        described_class.attach_file(active_storage_relation, file_with_special_name, space_id)

        expect(active_storage_relation).to have_received(:attach).with(
          hash_including(
            filename: special_filename,
            key: /^spaces\/#{space_id}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-#{Regexp.escape(special_filename)}$/
          )
        ).once
      end
    end
  end
end
