# frozen_string_literal: true

module Api
  module V1
    module Imports
      class ImportsController < ApiController
        def index
          params_hash = with_current_params(index_params)
          # Space is already available via current_space in with_current_params
          query = ::Imports::Queries::ListImports.new(
            relation: ::Imports::Import.where(space: current_space),
            **params_hash
          )
          result = query.call

          return render_internal_server_error(details: result.failure) unless result.success?

          imports = result.value!
          render_paginated(
            imports,
            serializer: ::Imports::Serializers::ImportSerializer,
            key: :imports
          )
        end

        def show
          import = ::Imports::Import.find_by(id: params[:id], space: current_space)
          return render_not_found(details: "Import not found") if import.nil?

          serializer = ::Imports::Serializers::ImportSerializer.render_as_hash(import)
          render_success(data: { import: serializer })
        end

        def create
          params_hash = with_current_params(create_params).merge(
            file: params[:file]
          )

          operation = ::Imports::Operations::CreateImport.new.call(params_hash)

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          import = operation.value!
          serializer = ::Imports::Serializers::ImportSerializer.render_as_hash(import)
          render_created(data: { import: serializer })
        end

        def revert
          import = ::Imports::Import.find_by(id: params[:id], space: current_space)
          return render_not_found(details: "Import not found") if import.nil?

          operation = ::Imports::Operations::RevertImport.new.call(import: import)

          return render_unprocessable_content(details: operation.failure) unless operation.success?

          render_success(
            message: operation.value![:message],
            data: ::Imports::Serializers::ImportSerializer.render_as_hash(import.reload)
          )
        end

        private

        def index_params
          params.permit(:page, :per_page, :status).to_h.symbolize_keys
        end

        def create_params
          params.permit(:import_location, :file, metadata: {})
        end
      end
    end
  end
end
