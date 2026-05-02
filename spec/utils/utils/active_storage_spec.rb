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

  describe '.attach_same_blobs_from' do
    let(:user) { create(:user) }
    let(:space) { create(:personal_space) }
    let(:account) { create(:account, space:, balance: Money.from_amount(1000, 'PHP')) }
    let(:category) { create(:category, space:, category_type: 'expense', name: 'Regular Expense') }
    let(:source_record) do
      create(
        :expense_transaction,
        :one_time,
        user:,
        space:,
        account:,
        category:,
        date: Time.zone.today
      )
    end
    let(:target_record) do
      create(
        :expense_transaction,
        :one_time,
        user:,
        space:,
        account:,
        category:,
        date: Time.zone.today
      )
    end
    let(:fixture_path) { Rails.root.join('spec', 'fixtures', 'files', 'test.jpg') }

    before do
      source_record.files.attach(
        io: File.open(fixture_path),
        filename: 'test.jpg',
        content_type: 'image/jpeg'
      )
    end

    it 'attaches the same blobs as the source without duplicating blob rows for each byte-size copy' do
      described_class.attach_same_blobs_from(source_record:, target_record:)

      expect(target_record.reload.files).to be_attached
      expect(target_record.files.blobs.map(&:id)).to eq(source_record.reload.files.blobs.map(&:id))
    end

    it 'does not duplicate attachments when run twice' do
      2.times { described_class.attach_same_blobs_from(source_record:, target_record:) }

      expect(target_record.reload.files.blobs.size).to eq(source_record.files.blobs.size)
    end

    it 'does nothing when the source has no files' do
      source_record.files.purge

      described_class.attach_same_blobs_from(source_record:, target_record:)

      expect(target_record.reload.files).not_to be_attached
    end

    it 'does not remove the shared blob from the parent when the child replaces its attachments' do
      described_class.attach_same_blobs_from(source_record:, target_record:)
      shared_blob_id = source_record.files.blobs.first.id

      target_record.reload.files.destroy_all
      target_record.files.attach(
        io: File.open(fixture_path),
        filename: 'replacement.jpg',
        content_type: 'image/jpeg'
      )

      expect(source_record.reload.files.blobs.map(&:id)).to include(shared_blob_id)
    end
  end
end
