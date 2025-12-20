# frozen_string_literal: true

module Api
  module V1
    module Imports
      class ImportRecordsController < ApiController
        def index
          import = ::Imports::Import.find_by(id: params[:import_id], space: current_space)
          return render_not_found(details: "Import not found") if import.nil?

          params_hash = { import_id: params[:import_id] }.merge(index_params)
          query = ::Imports::Queries::ListImportRecords.new(**params_hash)
          result = query.call

          return render_internal_server_error(details: result.failure) unless result.success?

          records = result.value!
          render_paginated(
            records,
            serializer: ::Imports::Serializers::ImportRecordSerializer,
            key: :import_records
          )
        end

        def show
          import = ::Imports::Import.find_by(id: params[:import_id], space: current_space)
          return render_not_found(details: "Import not found") if import.nil?

          import_record = import.import_records.find_by(id: params[:id])
          return render_not_found(details: "Import record not found") if import_record.nil?

          serializer = ::Imports::Serializers::ImportRecordSerializer.render_as_hash(import_record)
          render_success(data: { import_record: serializer })
        end

        def update
          import = ::Imports::Import.find_by(id: params[:import_id], space: current_space)
          return render_not_found(details: "Import not found") if import.nil?

          import_record = import.import_records.find_by(id: params[:id])
          return render_not_found(details: "Import record not found") if import_record.nil?

          params_hash = update_params.merge(import_record_id: import_record.id)
          operation = ::Imports::Operations::UpdateImportRecord.new.call(params_hash)

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          updated_record = operation.value!
          serializer = ::Imports::Serializers::ImportRecordSerializer.render_as_hash(updated_record)
          render_success(data: { import_record: serializer })
        end

        def import
          import = ::Imports::Import.find_by(id: params[:import_id], space: current_space)
          return render_not_found(details: "Import not found") if import.nil?

          import_record = import.import_records.find_by(id: params[:id])
          return render_not_found(details: "Import record not found") if import_record.nil?

          operation = ::Imports::Operations::ImportSingleRecord.new.call(import_record: import_record)

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          transaction = operation.value!
          render_success(
            message: "Record imported successfully",
            data: {
              transaction: ::Transactions::Serializers::TransactionSerializer.render_as_hash(transaction),
              import_record: ::Imports::Serializers::ImportRecordSerializer.render_as_hash(import_record.reload)
            }
          )
        end

        private

        def index_params
          params.permit(:page, :per_page, :status).to_h.symbolize_keys
        end

        def update_params
          params.permit(:date, :description, :amount, :type, :category)
        end
      end
    end
  end
end
